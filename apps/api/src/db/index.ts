import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DATA_DIR, DB_PATH } from '../config.js';

export { DATA_DIR, DB_PATH };

export interface ChildRow {
  id: string;
  nickname: string | null;
  avatar_id: string;
  age_band: string;
  created_at: string;
  current_level_id: string;
  /** Salted scrypt hash of the device token the child client presents. */
  device_token_hash: string;
  device_token_salt: string;
}

export interface LessonProgressRow {
  child_id: string;
  lesson_id: string;
  status: string;
  stars_earned: number;
  stars_possible: number;
  attempts: number;
  last_attempt_at: string | null;
  best_score: number;
}

export interface BadgeRow {
  child_id: string;
  badge_id: string;
  awarded_at: string;
}

export interface SessionRow {
  id: string;
  child_id: string;
  lesson_id: string;
  started_at: string;
  ended_at: string | null;
  stars_earned: number;
  stars_possible: number;
  score: number;
}

export interface EventRow {
  id: string;
  session_id: string;
  child_id: string;
  activity_id: string;
  lesson_id: string;
  response: string | null;
  score: number;
  elapsed_ms: number;
  hints_used: number;
  completed_at: string;
}

export interface SkillMasteryRow {
  child_id: string;
  skill: string;
  mastery: number;
}

export interface SettingsRow {
  child_id: string;
  daily_limit_minutes: number;
  bedtime_lock: string | null;
  bedtime_wake: string | null;
  sharing_requires_approval: number;
  microphone_enabled: number;
  offline_downloads_enabled: number;
  audio_enabled: number;
  caregiver_locale: string;
  allow_outbound_network: number;
}

export interface ActivityStatRow {
  child_id: string;
  activity_id: string;
  score: number;
}

let db: Database.Database | undefined;

export function getDb(): Database.Database {
  if (db) return db;
  mkdirSync(dirname(DB_PATH), { recursive: true });
  const instance = new Database(DB_PATH);
  instance.pragma('journal_mode = WAL');
  instance.pragma('foreign_keys = ON');
  migrate(instance);
  db = instance;
  return db;
}

export function closeDb(): void {
  db?.close();
  db = undefined;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS children (
  id                TEXT PRIMARY KEY,
  nickname          TEXT,
  avatar_id         TEXT NOT NULL,
  age_band          TEXT NOT NULL,
  created_at        TEXT NOT NULL,
  current_level_id  TEXT NOT NULL,
  device_token_hash TEXT NOT NULL,
  device_token_salt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS lesson_progress (
  child_id        TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  lesson_id       TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'locked',
  stars_earned    INTEGER NOT NULL DEFAULT 0,
  stars_possible  INTEGER NOT NULL DEFAULT 0,
  attempts        INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TEXT,
  best_score      REAL NOT NULL DEFAULT 0,
  PRIMARY KEY (child_id, lesson_id)
);

CREATE TABLE IF NOT EXISTS badges (
  child_id   TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  badge_id   TEXT NOT NULL,
  awarded_at TEXT NOT NULL,
  PRIMARY KEY (child_id, badge_id)
);

CREATE TABLE IF NOT EXISTS sessions (
  id            TEXT PRIMARY KEY,
  child_id      TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  lesson_id     TEXT NOT NULL,
  started_at    TEXT NOT NULL,
  ended_at      TEXT,
  stars_earned  INTEGER NOT NULL DEFAULT 0,
  stars_possible INTEGER NOT NULL DEFAULT 0,
  score         REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS session_events (
  id           TEXT PRIMARY KEY,
  session_id   TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  child_id     TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  activity_id  TEXT NOT NULL,
  lesson_id    TEXT NOT NULL,
  response     TEXT,
  score        REAL NOT NULL DEFAULT 0,
  elapsed_ms   INTEGER NOT NULL DEFAULT 0,
  hints_used   INTEGER NOT NULL DEFAULT 0,
  completed_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS skill_mastery (
  child_id TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  skill    TEXT NOT NULL,
  mastery  REAL NOT NULL DEFAULT 0,
  PRIMARY KEY (child_id, skill)
);

CREATE TABLE IF NOT EXISTS settings (
  child_id                  TEXT PRIMARY KEY REFERENCES children(id) ON DELETE CASCADE,
  daily_limit_minutes       INTEGER NOT NULL DEFAULT 0,
  bedtime_lock              TEXT,
  bedtime_wake              TEXT,
  sharing_requires_approval INTEGER NOT NULL DEFAULT 1,
  microphone_enabled        INTEGER NOT NULL DEFAULT 1,
  offline_downloads_enabled INTEGER NOT NULL DEFAULT 1,
  audio_enabled             INTEGER NOT NULL DEFAULT 1,
  caregiver_locale          TEXT NOT NULL DEFAULT 'en',
  allow_outbound_network    INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS caregiver_pin (
  child_id    TEXT PRIMARY KEY REFERENCES children(id) ON DELETE CASCADE,
  pin_hash    TEXT NOT NULL,
  pin_salt    TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS activity_stats (
  child_id   TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  activity_id TEXT NOT NULL,
  score      REAL NOT NULL,
  PRIMARY KEY (child_id, activity_id)
);

CREATE INDEX IF NOT EXISTS idx_sessions_child ON sessions(child_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_session ON session_events(session_id);
CREATE INDEX IF NOT EXISTS idx_events_child ON session_events(child_id, completed_at DESC);
`;

function migrate(instance: Database.Database): void {
  instance.exec(SCHEMA);
}
