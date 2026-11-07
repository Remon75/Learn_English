import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Activity, Lesson } from '@sparkle/shared';
import { api } from '../lib/api';
import { useAppStore } from '../store/app';
import { loadMediaManifest, playMedia, playTone, speak } from '../lib/audio';
import { cacheLesson } from '../lib/offline';
import { StarBurst } from '../components/StarBurst';
import { ChooseActivity } from '../components/activities/ChooseActivity';
import { MatchActivity } from '../components/activities/MatchActivity';
import { OrderActivity } from '../components/activities/OrderActivity';
import { ListenActivity } from '../components/activities/ListenActivity';
import { SpeakActivity } from '../components/activities/SpeakActivity';
import { TraceActivity } from '../components/activities/TraceActivity';
import { StoryActivity } from '../components/activities/StoryActivity';

/**
 * The lesson player.
 *
 * One activity is on screen at a time. Each activity is rendered by a
 * dedicated component that reports a normalised `score` (0..1) back to the
 * player, which forwards it to the server. The server decides the stars.
 */
export function LessonScreen() {
  const lessonId = useAppStore((s) => s.lessonId);
  const lessonTitle = useAppStore((s) => s.lessonTitle);
  const activityIndex = useAppStore((s) => s.activityIndex);
  const activityCount = useAppStore((s) => s.activityCount);
  const sessionComplete = useAppStore((s) => s.sessionComplete);
  const sessionStars = useAppStore((s) => s.sessionStars);
  const sessionBadges = useAppStore((s) => s.sessionBadges);
  const nextLessonId = useAppStore((s) => s.nextLessonId);
  const recordActivity = useAppStore((s) => s.recordActivity);
  const completeLesson = useAppStore((s) => s.completeLesson);
  const resetLesson = useAppStore((s) => s.resetLesson);
  const openLesson = useAppStore((s) => s.openLesson);
  const setScreen = useAppStore((s) => s.setScreen);

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const startedAtRef = useRef<number>(Date.now());
  const hintsRef = useRef<number>(0);

  useEffect(() => {
    if (!lessonId) return;
    let cancelled = false;

    const load = async () => {
      try {
        const { lesson: loaded } = await api.getLesson(lessonId);
        if (cancelled) return;
        setLesson(loaded);
        await cacheLesson(lessonId, loaded);
      } catch {
        // Offline: fall back to the locally cached copy.
        const { getCachedLesson } = await import('../lib/offline');
        const cached = await getCachedLesson(lessonId);
        if (!cancelled && cached) setLesson(cached.payload as Lesson);
      }
    };
    void load();

    return () => {
      cancelled = true;
    };
  }, [lessonId]);

  const activity = useMemo<Activity | null>(
    () => lesson?.activities[activityIndex] ?? null,
    [lesson, activityIndex],
  );

  // Speak the instruction as soon as a new activity appears.
  useEffect(() => {
    if (!activity) return;
    startedAtRef.current = Date.now();
    hintsRef.current = 0;
    let cancelled = false;

    // The media manifest decides whether a stimulus is a placeholder tone
    // (which is spoken) or a real recording (which is played).
    void loadMediaManifest().then(() => {
      if (cancelled) return;
      if (activity.stimulus?.kind === 'audio') {
        playMedia(activity.stimulus);
      } else if (activity.instructionAudio?.kind === 'audio') {
        playMedia(activity.instructionAudio);
      } else {
        speak(activity.prompt);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [activity]);

  const handleResult = useCallback(
    async (result: { response?: string; score: number; correct: boolean }) => {
      if (!activity) return;

      await recordActivity({
        activityId: activity.id,
        ...(result.response !== undefined ? { response: result.response } : {}),
        score: result.score,
        elapsedMs: Date.now() - startedAtRef.current,
        hintsUsed: hintsRef.current,
      });

      if (result.correct) {
        playTone('correct');
      } else {
        playTone('wrong');
      }
    },
    [activity, recordActivity],
  );

  const handleHintUsed = useCallback(() => {
    hintsRef.current += 1;
  }, []);

  const handleNext = useCallback(() => {
    if (!lesson) return;
    if (activityIndex + 1 >= lesson.activities.length) {
      void completeLesson();
      setShowCelebration(true);
      return;
    }
    useAppStore.setState({ activityIndex: activityIndex + 1 });
  }, [activityIndex, completeLesson, lesson]);
  if (!lesson || !activity) {
    return (
      <div style={{ flex: 1, display: 'grid', placeItems: 'center' }}>
        <p style={{ fontSize: '1.3rem', color: 'var(--color-text-muted)' }}>Loading lesson…</p>
      </div>
    );
  }

  if (sessionComplete) {
    return (
      <>
        <div
          className="animate-fade"
          style={{
            flex: 1,
            overflowY: 'auto',
            display: 'grid',
            placeContent: 'center',
            justifyItems: 'center',
            gap: 'var(--space-md)',
            padding: 'var(--space-lg)',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '5rem' }} aria-hidden="true">
            🎉
          </div>
          <h1 style={{ fontSize: '2.4rem', color: 'var(--color-primary-dark)' }}>Well done!</h1>
          <p style={{ fontSize: '1.4rem' }}>
            You earned <strong>{sessionStars}</strong> stars
          </p>

          {sessionBadges.length > 0 && (
            <div className="card animate-pop" style={{ display: 'grid', gap: 8 }}>
              <h2 style={{ fontSize: '1.3rem' }}>New badges</h2>
              {sessionBadges.map((badge) => (
                <p key={badge.badgeId} style={{ margin: 0, fontSize: '1.1rem' }}>
                  <span aria-hidden="true">🏅 </span>
                  <strong>{badge.title}</strong> — {badge.description}
                </p>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap', justifyContent: 'center' }}>
            {nextLessonId && (
              <button className="btn btn--large" onClick={() => void openLesson(nextLessonId)}>
                Next adventure →
              </button>
            )}
            <button className="btn btn--ghost btn--large" onClick={() => setScreen('rewards')}>
              My badges
            </button>
            <button className="btn btn--ghost btn--large" onClick={resetLesson}>
              Back to map
            </button>
          </div>
        </div>

        {/* The particle burst must live outside the lesson branch so it is
            still mounted on the completion screen. */}
        <StarBurst visible={showCelebration} onDone={() => setShowCelebration(false)} />
      </>
    );
  }

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        padding: 'var(--space-md)',
        gap: 'var(--space-md)',
      }}
    >
      <header style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
        <button
          className="btn btn--ghost"
          onClick={resetLesson}
          aria-label="Leave the lesson and go back to the map"
          style={{ minWidth: 64 }}
        >
          <span aria-hidden="true">←</span>
        </button>

        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: '1.5rem' }}>{lessonTitle}</h1>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={activityCount}
            aria-valuenow={activityIndex + 1}
            aria-label="Lesson progress"
            style={{
              height: 14,
              background: 'var(--color-surface-alt)',
              borderRadius: 'var(--radius-full)',
              overflow: 'hidden',
              marginTop: 6,
            }}
          >
            <div
              style={{
                width: `${((activityIndex + 1) / Math.max(activityCount, 1)) * 100}%`,
                height: '100%',
                background: 'var(--color-secondary)',
                borderRadius: 'var(--radius-full)',
                transition: 'width 320ms ease',
              }}
            />
          </div>
        </div>

        <span
          aria-label={`Activity ${activityIndex + 1} of ${activityCount}`}
          style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--color-text-muted)' }}
        >
          {activityIndex + 1}/{activityCount}
        </span>
      </header>

      <main
        className="card animate-fade"
        key={activity.id}
        style={{
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-md)',
          justifyContent: 'center',
        }}
      >
        <h2 style={{ fontSize: '1.8rem', textAlign: 'center' }}>{activity.prompt}</h2>

        {activity.kind === 'choose' && (
          <ChooseActivity activity={activity} onResult={handleResult} onNext={handleNext} onHint={handleHintUsed} />
        )}
        {activity.kind === 'match' && (
          <MatchActivity activity={activity} onResult={handleResult} onNext={handleNext} onHint={handleHintUsed} />
        )}
        {activity.kind === 'order' && (
          <OrderActivity activity={activity} onResult={handleResult} onNext={handleNext} onHint={handleHintUsed} />
        )}
        {activity.kind === 'listen' && (
          <ListenActivity activity={activity} onResult={handleResult} onNext={handleNext} onHint={handleHintUsed} />
        )}
        {activity.kind === 'speak' && (
          <SpeakActivity activity={activity} onResult={handleResult} onNext={handleNext} onHint={handleHintUsed} />
        )}
        {activity.kind === 'trace' && (
          <TraceActivity activity={activity} onResult={handleResult} onNext={handleNext} onHint={handleHintUsed} />
        )}
        {activity.kind === 'story' && (
          <StoryActivity activity={activity} onResult={handleResult} onNext={handleNext} onHint={handleHintUsed} />
        )}
      </main>

      <StarBurst visible={showCelebration} onDone={() => setShowCelebration(false)} />
    </div>
  );
}