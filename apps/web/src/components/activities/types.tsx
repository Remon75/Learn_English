import type { Activity } from '@sparkle/shared';

/**
 * Shared contract for every activity component.
 *
 * `score` is a 0..1 correctness value. The component decides how much it
 * can know; the server decides the stars. `onHint` is called whenever the
 * child is given a scaffold, which reduces the star value.
 */
export interface ActivityProps {
  activity: Activity;
  onResult: (result: { response?: string; score: number; correct: boolean }) => void | Promise<void>;
  /**
   * Called when the child taps the "Next" button. The activity component is
   * responsible for resetting its own local state; the lesson player owns
   * navigation.
   */
  onNext: () => void;
  onHint?: () => void;
}

/** Shared feedback banner shown under every activity. */
export function Feedback({
  state,
  message,
}: {
  state: 'idle' | 'correct' | 'wrong';
  message?: string;
}) {
  if (state === 'idle') return null;
  const correct = state === 'correct';
  return (
    <p
      role="status"
      aria-live="polite"
      className={correct ? 'animate-pop' : 'animate-fade'}
      style={{
        margin: 0,
        textAlign: 'center',
        fontSize: '1.3rem',
        fontWeight: 700,
        color: correct ? 'var(--color-success)' : 'var(--color-error)',
      }}
    >
      <span aria-hidden="true">{correct ? '🎉 ' : '💪 '}</span>
      {message ?? (correct ? 'Yes!' : 'Try again!')}
    </p>
  );
}

/** A large, obvious "next" button. */
export function NextButton({
  onClick,
  label = 'Next',
}: {
  onClick: () => void;
  label?: string;
}) {
  return (
    <button className="btn btn--large" onClick={onClick} style={{ alignSelf: 'center' }}>
      {label} <span aria-hidden="true">→</span>
    </button>
  );
}

/** A "listen again" button used by every aural activity. */
export function ReplayButton({ onClick, label = 'Hear it again' }: { onClick: () => void; label?: string }) {
  return (
    <button className="btn btn--ghost" onClick={onClick}>
      <span aria-hidden="true">🔊</span> {label}
    </button>
  );
}
