import { useState } from 'react';
import { playTone } from '../../lib/audio';
import { Feedback, NextButton, type ActivityProps } from './types';

/**
 * Open-ended storytelling.
 *
 * The child narrates a picture sequence. There is no single right answer:
 * the activity measures engagement and lets the caregiver judge. The score
 * is intentionally generous so the child is never discouraged from
 * speaking.
 */
export function StoryActivity({ activity, onResult, onNext }: ActivityProps) {
  const [said, setSaid] = useState(false);
  const [state, setState] = useState<'idle' | 'correct' | 'wrong'>('idle');

  const finish = async () => {
    playTone('correct');
    setSaid(true);
    setState('correct');
    await onResult({ response: 'said', score: 1, correct: true });
  };

  return (
    <div style={{ display: 'grid', gap: 'var(--space-md)', justifyItems: 'center' }}>
      {activity.stimulus?.kind === 'image' && (
        <img
          src={activity.stimulus.src}
          alt={activity.stimulus.label ?? ''}
          style={{ maxWidth: '100%', borderRadius: 'var(--radius-lg)', maxHeight: 260 }}
        />
      )}

      {activity.speakTarget && (
        <p style={{ fontSize: '1.5rem', fontWeight: 700, textAlign: 'center' }}>
          “{activity.speakTarget}”
        </p>
      )}

      <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', maxWidth: 420 }}>
        Tell the story out loud in your own words. There is no wrong answer.
      </p>

      {!said && (
        <button className="btn btn--large" onClick={() => void finish()}>
          <span aria-hidden="true">🎤</span> I told my story
        </button>
      )}

      <Feedback state={state} />

      {said && (
        <NextButton
          onClick={() => {
            setSaid(false);
            onNext();
          }}
        />
      )}
    </div>
  );
}
