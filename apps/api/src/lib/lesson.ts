import type { Activity, Lesson, MediaRef } from '@sparkle/shared';
import { mediaUrl } from '../routes/media.js';

/**
 * Rewrites logical media paths to concrete, extension-bearing URLs.
 *
 * The curriculum stores extension-less logical ids so the asset format can
 * change without editing content. The client, however, needs a real
 * extension for reliable audio decoding, so it is resolved on the way out.
 */
export function resolveMediaRef(ref: MediaRef): MediaRef {
  return { ...ref, src: mediaUrl(ref.src) };
}

export function resolveActivity(activity: Activity): Activity {
  return {
    ...activity,
    ...(activity.stimulus ? { stimulus: resolveMediaRef(activity.stimulus) } : {}),
    ...(activity.instructionAudio
      ? { instructionAudio: resolveMediaRef(activity.instructionAudio) }
      : {}),
    ...(activity.options
      ? {
          options: activity.options.map((option) =>
            option.media ? { ...option, media: resolveMediaRef(option.media) } : option,
          ),
        }
      : {}),
    ...(activity.pairs
      ? {
          pairs: activity.pairs.map((pair) => ({
            ...pair,
            left: resolveMediaRef(pair.left),
            right: resolveMediaRef(pair.right),
          })),
        }
      : {}),
  };
}

export function resolveLesson(lesson: Lesson): Lesson {
  return { ...lesson, activities: lesson.activities.map(resolveActivity) };
}
