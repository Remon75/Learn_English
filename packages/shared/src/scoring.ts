import type {
  Activity,
  ChoiceOption,
  Lesson,
  MatchPair,
  SessionEvent,
  SessionSummary,
} from './types.js';
import { BADGES_BY_ID, evaluateBadges } from './badges.js';

/**
 * Scoring rules.
 *
 * Every value is deterministic and computed from the child's own actions.
 * There is no randomness, no probability, and no hidden multiplier - the
 * same answers always produce the same stars, which matters for a
 * child-facing product that must feel fair.
 */

export const MAX_STARS_PER_ACTIVITY = 3;

/** Hints reduce the star value but never remove credit for the attempt. */
export function starsForActivity(activity: Activity, event: SessionEvent): number {
  if (event.score < 0.5) return 0;
  let stars: number = activity.stars;
  if (event.hintsUsed >= 2) stars = Math.max(1, stars - 2);
  else if (event.hintsUsed === 1) stars = Math.max(1, stars - 1);
  return Math.min(stars, MAX_STARS_PER_ACTIVITY);
}

/** Grades an objective answer against the activity definition. */
export function gradeResponse(activity: Activity, response: string | undefined): number {
  if (!response) return 0;
  const normalised = response.trim().toLowerCase();

  switch (activity.kind) {
    case 'choose': {
      const options = activity.options ?? [];
      const picked = options.find((o) => o.id === normalised);
      return picked?.correct ? 1 : 0;
    }
    case 'match': {
      const pairs = activity.pairs ?? [];
      if (!pairs.length) return 0;
      // A match response is encoded as "leftId=rightId,leftId=rightId".
      const entries = normalised
        .split(',')
        .map((part) => part.split('='))
        .filter((parts): parts is [string, string] => parts.length === 2);
      if (entries.length !== pairs.length) return 0;
      const valid = entries.every(([left, right]) =>
        pairs.some((p: MatchPair) => p.id === left && matchRight(p, right)),
      );
      return valid ? 1 : 0;
    }
    case 'order': {
      const solution = activity.solution ?? [];
      if (!solution.length) return 0;
      const given = normalised.split('|').filter(Boolean);
      if (given.length !== solution.length) return 0;
      return given.every((token, i) => token.trim().toLowerCase() === solution[i]?.trim().toLowerCase())
        ? 1
        : 0;
    }
    case 'trace': {
      const expected = (activity.expected ?? '').toLowerCase();
      if (!expected) return 0;
      return normalised === expected ? 1 : 0;
    }
    case 'listen': {
      const expected = (activity.expected ?? '').toLowerCase();
      if (!expected) return 0;
      return normalised === expected ? 1 : 0;
    }
    case 'speak': {
      // Speaking is self-assessed at MVP: the child (or caregiver) confirms
      // "I said it". A future ASR scorer can replace this without changing
      // the contract, because the client sends the score it observed.
      return normalised === 'said' || normalised === 'true' ? 1 : 0;
    }
    case 'story': {
      return normalised.length >= 3 ? 1 : 0;
    }
    default:
      return 0;
  }
}

function matchRight(pair: MatchPair, right: string): boolean {
  return (
    pair.right.src === right ||
    pair.right.src.endsWith(right) ||
    pair.right.label?.toLowerCase() === right.toLowerCase()
  );
}

/**
 * Reduces a raw event list to one event per activity.
 *
 * A child may tap a wrong answer several times before getting it right.
 * Only the best attempt counts, so stars can never be inflated by repeated
 * taps and a single mistake does not erase a correct answer.
 */
export function bestAttemptPerActivity(events: SessionEvent[]): SessionEvent[] {
  const best = new Map<string, SessionEvent>();
  for (const event of events) {
    const current = best.get(event.activityId);
    if (!current || event.score > current.score) {
      best.set(event.activityId, event);
    }
  }
  return [...best.values()];
}

export interface ScoringInput {
  lesson: Lesson;
  events: SessionEvent[];
  totalStarsBefore: number;
  lessonsCompletedBefore: number;
  perfectActivitiesBefore: number;
  skillMasteryBefore: Record<string, number>;
  currentStreakDays: number;
  speakingRecordingsBefore: number;
  alreadyAwardedBadges: Set<string>;
  /**
   * Whether every activity in the lesson was attempted. A partial session
   * must not count towards "lessons completed" badges.
   */
  lessonCompleted: boolean;
}

export interface ScoringResult extends SessionSummary {
  activityStars: Record<string, number>;
  totalStars: number;
  lessonsCompleted: number;
  perfectActivities: number;
  skillMastery: Record<string, number>;
  speakingRecordings: number;
}

/**
 * Computes the outcome of a completed session.
 *
 * Skill mastery is an average of per-skill accuracy across attempted
 * activities, clamped to 0..1. A skill counts as "mastered" at 0.8.
 */
export function scoreSession(input: ScoringInput): ScoringResult {
  const activityStars: Record<string, number> = {};
  let starsEarned = 0;
  let starsPossible = 0;
  let perfectActivitiesThisSession = 0;
  let speakingRecordingsThisSession = 0;

  const skillTotals = new Map<string, { sum: number; count: number }>();

  // Collapse retries: one attempt per activity, the best one.
  const attempts = bestAttemptPerActivity(input.events);

  for (const event of attempts) {
    const activity = input.lesson.activities.find((a) => a.id === event.activityId);
    if (!activity) continue;

    const stars = starsForActivity(activity, event);
    activityStars[event.activityId] = stars;
    starsEarned += stars;
    starsPossible += activity.stars;

    if (event.score >= 0.99) perfectActivitiesThisSession += 1;
    if (activity.kind === 'speak' && event.score >= 0.5) speakingRecordingsThisSession += 1;

    for (const skill of activity.skills) {
      const bucket = skillTotals.get(skill) ?? { sum: 0, count: 0 };
      bucket.sum += event.score;
      bucket.count += 1;
      skillTotals.set(skill, bucket);
    }
  }

  const skillMastery: Record<string, number> = { ...input.skillMasteryBefore };
  for (const [skill, bucket] of skillTotals) {
    const sessionMastery = bucket.count > 0 ? bucket.sum / bucket.count : 0;
    const previous = skillMastery[skill] ?? 0;
    // Weight the new evidence by how many activities the skill had in this
    // session, so one activity cannot wipe out a long history.
    const weight = bucket.count / (bucket.count + 5);
    skillMastery[skill] = Math.max(0, Math.min(1, previous * (1 - weight) + sessionMastery * weight));
  }

  const lessonsCompleted =
    input.lessonsCompletedBefore + (input.lessonCompleted ? 1 : 0);
  const totalStars = input.totalStarsBefore + starsEarned;
  const perfectActivities = input.perfectActivitiesBefore + perfectActivitiesThisSession;
  const speakingRecordings = input.speakingRecordingsBefore + speakingRecordingsThisSession;

  const newBadges = evaluateBadges(
    {
      lessonsCompleted,
      totalStars,
      perfectActivities,
      skillMastery,
      currentStreakDays: input.currentStreakDays,
      speakingRecordings,
    },
    input.alreadyAwardedBadges,
  ).map((badge) => ({
    badgeId: badge.id,
    awardedAt: new Date().toISOString(),
    title: badge.title,
    description: badge.description,
    icon: badge.icon,
  }));

  return {
    sessionId: '',
    starsEarned,
    starsPossible,
    score: starsPossible > 0 ? starsEarned / starsPossible : 0,
    newBadges,
    activityStars,
    totalStars,
    lessonsCompleted,
    perfectActivities,
    skillMastery,
    speakingRecordings,
  };
}

export function badgeById(id: string) {
  return BADGES_BY_ID.get(id);
}
