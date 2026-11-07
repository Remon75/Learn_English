import { create } from 'zustand';
import type { AwardedBadge, MapNode } from '@sparkle/shared';import { api, setDeviceToken, getDeviceToken } from '../lib/api';
import { flushEvents, queueEvent, type QueuedEvent } from '../lib/offline';

/**
 * Application state.
 *
 * The store keeps the child-facing session state in memory and mirrors the
 * durable parts into IndexedDB. The server remains the authority for stars
 * and badges; the client only mirrors what the server has confirmed.
 */

export type Screen = 'loading' | 'welcome' | 'map' | 'lesson' | 'rewards' | 'parent';

interface AppState {
  screen: Screen;
  childId: string | null;
  nickname: string | null;
  avatarId: string;
  totalStars: number;
  nodes: MapNode[];
  badges: AwardedBadge[];
  isOnline: boolean;
  error: string | null;

  // Current session
  sessionId: string | null;
  lessonId: string | null;
  lessonTitle: string | null;
  activityIndex: number;
  activityCount: number;
  sessionStars: number;
  sessionBadges: AwardedBadge[];
  sessionComplete: boolean;
  nextLessonId: string | null;

  setError: (message: string | null) => void;
  bootstrap: () => Promise<void>;
  createProfile: (input: {
    nickname?: string;
    avatarId: string;
    ageBand: string;
    caregiverPin: string;
  }) => Promise<void>;
  loadMap: () => Promise<void>;
  openLesson: (lessonId: string) => Promise<void>;
  recordActivity: (input: {
    activityId: string;
    response?: string;
    score?: number;
    elapsedMs: number;
    hintsUsed: number;
  }) => Promise<void>;
  completeLesson: () => Promise<void>;
  resetLesson: () => void;
  setScreen: (screen: Screen) => void;
  signOut: () => void;
}

const AVATAR_IDS = ['fox', 'owl', 'panda', 'cat', 'frog', 'bear'] as const;

export const useAppStore = create<AppState>((set, get) => ({
  screen: 'loading',
  childId: null,
  nickname: null,
  avatarId: 'fox',
  totalStars: 0,
  nodes: [],
  badges: [],
  isOnline: typeof navigator === 'undefined' ? true : navigator.onLine,
  error: null,

  sessionId: null,
  lessonId: null,
  lessonTitle: null,
  activityIndex: 0,
  activityCount: 0,
  sessionStars: 0,
  sessionBadges: [],
  sessionComplete: false,
  nextLessonId: null,

  setError: (message) => set({ error: message }),

  bootstrap: async () => {
    const token = getDeviceToken();
    if (!token) {
      set({ screen: 'welcome' });
      return;
    }
    try {
      const profile = await api.getProfile();
      set({
        screen: 'map',
        childId: profile.id,
        nickname: profile.nickname,
        avatarId: profile.avatarId,
      });
      await get().loadMap();
      await flushQueued();
    } catch {
      // No server or no valid token: fall back to the welcome screen, but
      // keep the token so a later retry can pick up where it left off.
      set({ screen: 'welcome' });
    }
  },

  createProfile: async (input) => {
    const result = await api.createProfile(input);
    setDeviceToken(result.deviceToken);
    set({
      screen: 'map',
      childId: result.profile.id,
      nickname: result.profile.nickname,
      avatarId: result.profile.avatarId,
    });
    await get().loadMap();
  },

  loadMap: async () => {
    try {
      const map = await api.getMap();
      set({ nodes: map.nodes, totalStars: map.totalStars, isOnline: true });
    } catch {
      set({ isOnline: false });
    }
  },

  openLesson: async (lessonId) => {
    try {
      const session = await api.startSession(lessonId);
      set({
        screen: 'lesson',
        sessionId: session.sessionId,
        lessonId,
        lessonTitle: session.lesson.title,
        activityIndex: 0,
        activityCount: session.lesson.activities.length,
        sessionStars: 0,
        sessionBadges: [],
        sessionComplete: false,
        nextLessonId: null,
        error: null,
      });
    } catch (error) {
      set({
        error:
          error instanceof Error
            ? error.message
            : 'Could not start the lesson. Please try again.',
      });
    }
  },

  recordActivity: async (input) => {
    const { sessionId, lessonId, childId } = get();
    if (!sessionId || !lessonId || !childId) return;

    const event: Omit<QueuedEvent, 'synced' | 'attempts'> = {
      sessionId,
      childId,
      lessonId,
      activityId: input.activityId,
      ...(input.response !== undefined ? { response: input.response } : {}),
      ...(input.score !== undefined ? { score: input.score } : {}),
      elapsedMs: input.elapsedMs,
      hintsUsed: input.hintsUsed,
      completedAt: new Date().toISOString(),
    };

    try {
      await api.recordEvent(sessionId, input);
      set({ isOnline: true });
    } catch {
      // Queue it locally. The child continues without interruption and the
      // event is delivered when the network returns.
      await queueEvent(event);
      set({ isOnline: false });
    }
  },

  completeLesson: async () => {
    const { sessionId } = get();
    if (!sessionId) return;
    try {
      const result = await api.completeSession(sessionId);
      set({
        sessionStars: result.starsEarned,
        sessionBadges: result.newBadges,
        sessionComplete: true,
        nextLessonId: result.nextLessonId ?? null,
      });
      await get().loadMap();
    } catch {
      set({ sessionComplete: true });
    }
  },

  resetLesson: () =>
    set({
      screen: 'map',
      sessionId: null,
      lessonId: null,
      lessonTitle: null,
      activityIndex: 0,
      activityCount: 0,
      sessionStars: 0,
      sessionBadges: [],
      sessionComplete: false,
      nextLessonId: null,
    }),

  setScreen: (screen) => set({ screen }),

  signOut: () => {
    setDeviceToken('');
    set({
      screen: 'welcome',
      childId: null,
      nickname: null,
      nodes: [],
      badges: [],
      totalStars: 0,
      error: null,
    });
  },
}));

/** Delivers any events that were captured while offline. */
async function flushQueued(): Promise<void> {
  try {
    await flushEvents(async (event) => {
      await api.recordEvent(event.sessionId, {
        activityId: event.activityId,
        ...(event.response !== undefined ? { response: event.response } : {}),
        ...(event.score !== undefined ? { score: event.score } : {}),
        elapsedMs: event.elapsedMs,
        hintsUsed: event.hintsUsed,
      });
    });
  } catch {
    // The queue stays intact and retries later.
  }
}

export { AVATAR_IDS };
