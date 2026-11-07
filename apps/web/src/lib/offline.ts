import Dexie, { type Table } from 'dexie';
import type { SessionEvent } from '@sparkle/shared';

/**
 * Offline store.
 *
 * Dexie wraps IndexedDB so that a lesson in progress survives a reload, a
 * closed tab, or the tablet losing Wi-Fi halfway through. Events are queued
 * locally and flushed when the API is reachable again.
 *
 * What is stored is deliberately minimal: which activity, what the child
 * chose, and whether it was right. No audio recordings, no camera frames,
 * no timestamps finer than a session.
 */

export interface QueuedEvent {
  /** Local auto-increment key. */
  id?: number;
  sessionId: string;
  childId: string;
  lessonId: string;
  activityId: string;
  response?: string;
  score?: number;
  elapsedMs: number;
  hintsUsed: number;
  completedAt: string;
  /** True once the server has acknowledged the event. */
  synced: boolean;
  attempts: number;
}

export interface CachedLesson {
  lessonId: string;
  payload: unknown;
  cachedAt: string;
}

export interface LocalSession {
  sessionId: string;
  childId: string;
  lessonId: string;
  startedAt: string;
  events: SessionEvent[];
}

class SparkleDatabase extends Dexie {
  events!: Table<QueuedEvent, number>;
  lessons!: Table<CachedLesson, string>;
  sessions!: Table<LocalSession, string>;

  constructor() {
    super('sparkle-english');
    this.version(1).stores({
      events: '++id, sessionId, synced, completedAt',
      lessons: 'lessonId, cachedAt',
      sessions: 'sessionId, childId, lessonId',
    });
  }
}

export const db = new SparkleDatabase();

/** Queues an event for delivery. Returns the local row id. */
export async function queueEvent(event: Omit<QueuedEvent, 'synced' | 'attempts'>): Promise<number> {
  return db.events.add({ ...event, synced: false, attempts: 0 });
}

export async function pendingEvents(): Promise<QueuedEvent[]> {
  return db.events.where('synced').equals(0).toArray();
}

export async function markSynced(ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  await db.events.bulkDelete(ids);
}

export async function incrementAttempt(id: number): Promise<void> {
  await db.events.update(id, { attempts: (await db.events.get(id))?.attempts ?? 0 + 1 });
}

export async function cacheLesson(lessonId: string, payload: unknown): Promise<void> {
  await db.lessons.put({ lessonId, payload, cachedAt: new Date().toISOString() });
}

export async function getCachedLesson(lessonId: string): Promise<CachedLesson | undefined> {
  return db.lessons.get(lessonId);
}

export async function saveSession(session: LocalSession): Promise<void> {
  await db.sessions.put(session);
}

export async function getSession(sessionId: string): Promise<LocalSession | undefined> {
  return db.sessions.get(sessionId);
}

export async function deleteSession(sessionId: string): Promise<void> {
  await db.sessions.delete(sessionId);
}

/** Removes every local trace of a child. Used by the erasure flow. */
export async function purgeAll(): Promise<void> {
  await db.events.clear();
  await db.lessons.clear();
  await db.sessions.clear();
}

/**
 * Flushes queued events to the API.
 *
 * Returns the number of events delivered. Failures are left in the queue
 * and retried on the next flush, so a child never loses progress.
 */
export async function flushEvents(
  send: (event: QueuedEvent) => Promise<void>,
): Promise<{ delivered: number; failed: number }> {
  const queued = await pendingEvents();
  if (queued.length === 0) return { delivered: 0, failed: 0 };

  const deliveredIds: number[] = [];
  let failed = 0;

  for (const event of queued) {
    try {
      await send(event);
      if (event.id !== undefined) deliveredIds.push(event.id);
    } catch {
      failed += 1;
      await incrementAttempt(event.id!);
    }
  }

  await markSynced(deliveredIds);
  return { delivered: deliveredIds.length, failed };
}
