import type { Badge, BadgeRule } from './types.js';

/**
 * Reward catalogue.
 *
 * Rules are evaluated server-side against a child's progress so that the
 * client can never inflate a badge. Every badge is earned by doing the
 * activity itself - there are no streaks that punish absence, no
 * randomised reward boxes, and nothing that can be bought or lost.
 */
export const BADGES: Badge[] = [
  {
    id: 'first-step',
    title: 'First Step',
    description: 'Finished your very first lesson.',
    icon: 'sprout',
    rule: { type: 'lessons-completed', count: 1 },
  },
  {
    id: 'five-lessons',
    title: 'Bright Spark',
    description: 'Finished five lessons.',
    icon: 'spark',
    rule: { type: 'lessons-completed', count: 5 },
  },
  {
    id: 'twenty-lessons',
    title: 'Story Star',
    description: 'Finished twenty lessons.',
    icon: 'star',
    rule: { type: 'lessons-completed', count: 20 },
  },
  {
    id: 'ten-stars',
    title: 'Star Collector',
    description: 'Collected ten stars.',
    icon: 'stars',
    rule: { type: 'total-stars', count: 10 },
  },
  {
    id: 'fifty-stars',
    title: 'Star Galaxy',
    description: 'Collected fifty stars.',
    icon: 'galaxy',
    rule: { type: 'total-stars', count: 50 },
  },
  {
    id: 'sharp-ear',
    title: 'Sharp Ear',
    description: 'Got ten listening activities right.',
    icon: 'ear',
    rule: { type: 'perfect-activity', count: 10 },
  },
  {
    id: 'letter-master',
    title: 'Letter Master',
    description: 'Mastered the alphabet skill.',
    icon: 'abc',
    rule: { type: 'skill-mastered', skill: 'alphabet' },
  },
  {
    id: 'phonics-master',
    title: 'Sound Wizard',
    description: 'Mastered phonics blending.',
    icon: 'wand',
    rule: { type: 'skill-mastered', skill: 'phonics' },
  },
  {
    id: 'vocab-master',
    title: 'Word Builder',
    description: 'Mastered vocabulary.',
    icon: 'blocks',
    rule: { type: 'skill-mastered', skill: 'vocabulary' },
  },
  {
    id: 'grammar-master',
    title: 'Grammar Champ',
    description: 'Mastered simple grammar.',
    icon: 'puzzle',
    rule: { type: 'skill-mastered', skill: 'grammar' },
  },
  {
    id: 'brave-voice',
    title: 'Brave Voice',
    description: 'Spoke out loud ten times.',
    icon: 'mic',
    rule: { type: 'speaking-milestone', recordings: 10 },
  },
  {
    id: 'three-day-streak',
    title: 'Three in a Row',
    description: 'Learned three days in a row.',
    icon: 'calendar',
    rule: { type: 'streak', days: 3 },
  },
];

export const BADGES_BY_ID = new Map(BADGES.map((b) => [b.id, b]));

/**
 * Evaluates every badge rule against a progress snapshot.
 * Returns only badges that are newly satisfied and not yet awarded.
 */
export function evaluateBadges(
  progress: {
    lessonsCompleted: number;
    totalStars: number;
    perfectActivities: number;
    skillMastery: Record<string, number>;
    currentStreakDays: number;
    speakingRecordings: number;
  },
  alreadyAwarded: Set<string>,
): Badge[] {
  const satisfied = BADGES.filter((badge) => {
    if (alreadyAwarded.has(badge.id)) return false;
    return isRuleSatisfied(badge.rule, progress);
  });
  return satisfied;
}

export function isRuleSatisfied(
  rule: BadgeRule,
  progress: {
    lessonsCompleted: number;
    totalStars: number;
    perfectActivities: number;
    skillMastery: Record<string, number>;
    currentStreakDays: number;
    speakingRecordings: number;
  },
): boolean {
  switch (rule.type) {
    case 'lessons-completed':
      return progress.lessonsCompleted >= rule.count;
    case 'total-stars':
      return progress.totalStars >= rule.count;
    case 'perfect-activity':
      return progress.perfectActivities >= rule.count;
    case 'skill-mastered':
      return (progress.skillMastery[rule.skill] ?? 0) >= 0.8;
    case 'streak':
      return progress.currentStreakDays >= rule.days;
    case 'speaking-milestone':
      return progress.speakingRecordings >= rule.recordings;
  }
}
