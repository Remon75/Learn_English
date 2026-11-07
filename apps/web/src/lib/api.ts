/**
 * API client.
 *
 * Every request targets our own origin. There is no base URL pointing at a
 * third party, no analytics beacon, and no telemetry. When the network is
 * unavailable the client falls back to cached/queued data so that a lesson
 * already in progress always continues.
 */

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const DEVICE_TOKEN_KEY = 'sparkle.deviceToken';

export function getDeviceToken(): string | null {
  try {
    return localStorage.getItem(DEVICE_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setDeviceToken(token: string): void {
  try {
    localStorage.setItem(DEVICE_TOKEN_KEY, token);
  } catch {
    // Storage can be unavailable in private browsing; the session then
    // simply cannot persist between reloads.
  }
}

export function clearDeviceToken(): void {
  try {
    localStorage.removeItem(DEVICE_TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  caregiverPin?: string;
  signal?: AbortSignal;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { accept: 'application/json' };
  const token = getDeviceToken();
  if (token) headers['x-device-token'] = token;
  if (options.caregiverPin) headers['x-caregiver-pin'] = options.caregiverPin;

  let body: string | undefined;
  if (options.body !== undefined) {
    headers['content-type'] = 'application/json';
    body = JSON.stringify(options.body);
  }

  const res = await fetch(path, {
    method: options.method ?? 'GET',
    headers,
    body,
    signal: options.signal,
    credentials: 'same-origin',
  });

  const text = await res.text();
  const payload = text ? (JSON.parse(text) as unknown) : null;

  if (!res.ok) {
    const errorBody = payload as { error?: string; message?: string } | null;
    throw new ApiError(
      res.status,
      errorBody?.error ?? 'unknown_error',
      errorBody?.message ?? `Request failed with status ${res.status}`,
    );
  }

  return payload as T;
}

/* ------------------------------- Types ------------------------------- */

export interface Profile {
  id: string;
  nickname: string | null;
  avatarId: string;
  ageBand: string;
  createdAt: string;
  currentLevelId: string;
}

import type { LearningMap, MapNode } from '@sparkle/shared';

export type { LearningMap, MapNode };

export interface SessionStart {
  sessionId: string;
  lesson: import('@sparkle/shared').Lesson;
  startedAt: string;
}

export interface SessionComplete {
  sessionId: string;
  starsEarned: number;
  starsPossible: number;
  score: number;
  newBadges: import('@sparkle/shared').AwardedBadge[];
  nextLessonId?: string;
  completed: boolean;
}

export interface ParentSettingsResponse {
  settings: import('@sparkle/shared').ParentSettings;
}

export interface ProgressResponse {
  progress: import('@sparkle/shared').ChildProgress;
}

/* ------------------------------- Endpoints ------------------------------- */

export const api = {
  createProfile(input: {
    nickname?: string;
    avatarId: string;
    ageBand: string;
    caregiverPin: string;
  }) {
    return request<{ profile: Profile; deviceToken: string }>('/api/v1/profiles', {
      method: 'POST',
      body: input,
    });
  },

  getProfile() {
    return request<Profile>('/api/v1/profiles/me');
  },

  listProfiles() {
    return request<{ profiles: Profile[] }>('/api/v1/profiles');
  },

  getMap() {
    return request<LearningMap>('/api/v1/map');
  },

  getLesson(lessonId: string) {
    return request<{ lesson: import('@sparkle/shared').Lesson }>(
      `/api/v1/curriculum/lessons/${encodeURIComponent(lessonId)}`,
    );
  },

  startSession(lessonId: string) {
    return request<SessionStart>('/api/v1/sessions', {
      method: 'POST',
      body: { lessonId },
    });
  },

  recordEvent(
    sessionId: string,
    payload: {
      activityId: string;
      response?: string;
      score?: number;
      elapsedMs: number;
      hintsUsed: number;
    },
  ) {
    return request<{ accepted: boolean; score: number; correct: boolean }>(
      `/api/v1/sessions/${encodeURIComponent(sessionId)}/events`,
      { method: 'POST', body: payload },
    );
  },

  completeSession(sessionId: string) {
    return request<SessionComplete>(`/api/v1/sessions/${encodeURIComponent(sessionId)}/complete`, {
      method: 'POST',
    });
  },

  getSettings(pin: string) {
    return request<ParentSettingsResponse>('/api/v1/parent/settings', { caregiverPin: pin });
  },

  updateSettings(pin: string, settings: Partial<import('@sparkle/shared').ParentSettings>) {
    return request<ParentSettingsResponse>('/api/v1/parent/settings', {
      method: 'PUT',
      caregiverPin: pin,
      body: settings,
    });
  },

  getProgress(pin: string) {
    return request<ProgressResponse>('/api/v1/parent/progress', { caregiverPin: pin });
  },

  getReport(pin: string, days = 7) {
    return request<{ report: import('@sparkle/shared').TeacherReport }>(
      `/api/v1/parent/report?days=${days}`,
      { caregiverPin: pin },
    );
  },

  deleteProfile(pin: string) {
    return request<{ deleted: boolean }>('/api/v1/parent/profile', {
      method: 'DELETE',
      caregiverPin: pin,
    });
  },
};
