/**
 * Shared domain contracts for Sparkle English.
 *
 * Every type here is mirrored in the OpenAPI contract at
 * `postman/specs/sparkle-english.yaml`; keep the two in sync.
 */

export const AGES = {
  min: 3,
  max: 8,
} as const;

export type AgeBand = '3-4' | '5-6' | '7-8';

export type ActivityKind =
  | 'listen'
  | 'speak'
  | 'trace'
  | 'match'
  | 'choose'
  | 'order'
  | 'story';

export type MediaKind = 'audio' | 'image' | 'animation';

/**
 * A media asset is always served from our own origin. The field is
 * deliberately a plain relative path so that the app can be self-hosted
 * on a LAN, a VPS, or an offline tablet with no third-party host.
 */
export interface MediaRef {
  kind: MediaKind;
  /** Relative, same-origin path, e.g. `/media/audio/letter-a.mp3`. */
  src: string;
  /** Spoken/display label used for accessibility and for aural prompts. */
  label?: string;
  /** Seconds; used to pre-warm the audio cache and to draw progress bars. */
  durationSec?: number;
  /** Optional transcript for caregivers/teacher reports. */
  transcript?: string;
}

export interface ChoiceOption {
  id: string;
  label: string;
  media?: MediaRef;
  /** Correct options. An empty array means "no correct answer" (free play). */
  correct: boolean;
}

export interface MatchPair {
  id: string;
  left: MediaRef;
  right: MediaRef;
}

export interface Activity {
  id: string;
  kind: ActivityKind;
  /** Short instruction shown to the child (keep under ~5 words when possible). */
  prompt: string;
  /** Aural instruction. Children who cannot read yet rely on this. */
  instructionAudio?: MediaRef;
  /** What the child hears to start the task. */
  stimulus?: MediaRef;
  /** Options for `choose` activities. */
  options?: ChoiceOption[];
  /** Pairs for `match` activities. */
  pairs?: MatchPair[];
  /** Ordered tokens for `order` activities. */
  orderTokens?: string[];
  /** Correct order for `order` activities. */
  solution?: string[];
  /** Target phrase for `speak` activities. */
  speakTarget?: string;
  /** Expected answer for `listen`/`trace` activities. */
  expected?: string;
  /** Stars awarded for a correct first attempt (1-3). */
  stars: 1 | 2 | 3;
  /** Seconds; used to pace the UI and to keep sessions short. */
  seconds: number;
  /** Difficulty growth inside the unit. */
  difficulty: 1 | 2 | 3;
  /** Skill tags drive the teacher report and the phonics heat map. */
  skills: string[];
}

export interface Lesson {
  id: string;
  title: string;
  /** The concrete thing the child can do after this lesson. */
  objective: string;
  activities: Activity[];
}

export interface Unit {
  id: string;
  title: string;
  theme: string;
  /** Emoji-free, asset-free units still need a visual anchor. */
  icon: string;
  lessons: Lesson[];
}

export interface Level {
  id: string;
  title: string;
  description: string;
  ageBand: AgeBand;
  /** Number colour of the world map in the parent dashboard. */
  color: string;
  units: Unit[];
}

export interface Curriculum {
  levels: Level[];
}

/** A child's identifier is a random opaque token, never a name. */
export interface ChildProfile {
  id: string;
  /** Optional nickname. Never required, never used for analytics. */
  nickname?: string;
  avatarId: string;
  ageBand: AgeBand;
  createdAt: string;
  /** Per-child curriculum position. */
  currentLevelId: string;
}

export type LessonStatus = 'locked' | 'available' | 'in-progress' | 'completed';

/** A single node on the child's learning map. */
export interface MapNode {
  id: string;
  title: string;
  objective: string;
  levelId: string;
  levelTitle: string;
  levelColor: string;
  unitId: string;
  unitTitle: string;
  icon: string;
  status: LessonStatus;
  starsEarned: number;
  starsPossible: number;
  attempts: number;
}

/** The whole learning map, as returned by `GET /api/v1/map`. */
export interface LearningMap {
  childId: string;
  totalStars: number;
  nodes: MapNode[];
}

export interface LessonProgress {
  lessonId: string;
  status: LessonStatus;
  starsEarned: number;
  starsPossible: number;
  attempts: number;
  lastAttemptAt?: string;
  /** Best correctness ratio, 0..1. */
  bestScore: number;
}

export interface Badge {
  id: string;
  title: string;
  description: string;
  icon: string;
  /** How the badge is unlocked, evaluated server-side. */
  rule: BadgeRule;
}

export type BadgeRule =
  | { type: 'lessons-completed'; count: number }
  | { type: 'perfect-activity'; count: number }
  | { type: 'total-stars'; count: number }
  | { type: 'skill-mastered'; skill: string }
  | { type: 'streak'; days: number }
  | { type: 'speaking-milestone'; recordings: number };

export interface AwardedBadge {
  badgeId: string;
  awardedAt: string;
  title: string;
  description: string;
  icon: string;
}

export interface ChildProgress {
  childId: string;
  totalStars: number;
  badges: AwardedBadge[];
  lessons: Record<string, LessonProgress>;
  /** Skill -> 0..1 mastery, averaged over attempted activities. */
  skillMastery: Record<string, number>;
  currentStreakDays: number;
  longestStreakDays: number;
  speakingRecordings: number;
  totalMinutesLearned: number;
}

export interface SessionEvent {
  activityId: string;
  lessonId: string;
  /** The child's raw answer (label, token order, transcript, or self-rating). */
  response?: string;
  /** 0..1 correctness as judged by the app (speaking is self-rated at MVP). */
  score: number;
  elapsedMs: number;
  /** How many hints/scaffolds were consumed. */
  hintsUsed: number;
  completedAt: string;
}

export interface LessonSession {
  id: string;
  childId: string;
  lessonId: string;
  startedAt: string;
  endedAt?: string;
  events: SessionEvent[];
}

export interface SessionSummary {
  sessionId: string;
  starsEarned: number;
  starsPossible: number;
  score: number;
  /** Badges unlocked during this session. */
  newBadges: AwardedBadge[];
  nextLessonId?: string;
}

/** Parent/teacher controls. All values are local; nothing leaves the device. */
export interface ParentSettings {
  childId: string;
  /** Daily cap in minutes. 0 = unlimited (off by default, no dark patterns). */
  dailyLimitMinutes: number;
  /** Bedtime lock; local time "HH:mm". */
  bedtimeLock?: string;
  bedtimeWake?: string;
  /** Require adult gate before external sharing. */
  sharingRequiresApproval: boolean;
  /** Allow recording the child's voice for speaking practice. */
  microphoneEnabled: boolean;
  /** Allow downloading offline packs. */
  offlineDownloadsEnabled: boolean;
  /** Sound effects + music. */
  audioEnabled: boolean;
  /** Locale for the caregiver UI. */
  caregiverLocale: string;
  /** Master switch for any outbound network call. Default: false. */
  allowOutboundNetwork: boolean;
}

/** Caregiver-readable summary. Deliberately aggregate, never per-keystroke. */
export interface TeacherReport {
  childId: string;
  periodStart: string;
  periodEnd: string;
  minutesLearned: number;
  sessionsCompleted: number;
  lessonsCompleted: number;
  starsEarned: number;
  /** Total stars available across the whole curriculum, for a progress bar. */
  possibleStars: number;
  skillMastery: Record<string, number>;
  strengths: string[];
  focusAreas: string[];
  recentActivity: Array<{
    lessonId: string;
    lessonTitle: string;
    completedAt: string;
    score: number;
  }>;
}
