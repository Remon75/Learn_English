import { useState } from 'react';
import { playMedia, playTone } from '../../lib/audio';
import { Feedback, NextButton, type ActivityProps } from './types';

/**
 * Listening activity.
 *
 * The child hears a word and picks the matching picture. The word is spoken
 * by a locally hosted recording; when the repository only ships a
 * placeholder tone, the app speaks the word with the device voice instead.
 *
 * The transcript is deliberately *not* shown: it is the answer, and showing
 * it would turn a listening task into a reading task.
 */
export function ListenActivity({ activity, onResult, onNext }: ActivityProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [state, setState] = useState<'idle' | 'correct' | 'wrong'>('idle');

  const stimulus = activity.stimulus;
  const options = activity.options ?? [];

  const handleSelect = async (optionId: string, correct: boolean) => {
    playTone('tap');
    setSelected(optionId);
    setState(correct ? 'correct' : 'wrong');
    await onResult({ response: optionId, score: correct ? 1 : 0, correct });
  };

  /**
   * Safety net.
   *
   * A listen activity without options would leave the child with no way to
   * answer and no way forward. When that happens the child confirms that
   * they heard the word, which always completes the activity.
   */
  const handleHeard = async () => {
    playTone('correct');
    setState('correct');
    await onResult({ response: 'heard', score: 1, correct: true });
  };

  const reset = () => {
    setSelected(null);
    setState('idle');
  };

  return (
    <div style={{ display: 'grid', gap: 'var(--space-md)' }}>
      <div style={{ textAlign: 'center' }}>
        <button
          className="btn btn--large btn--secondary"
          onClick={() => stimulus && playMedia(stimulus)}
          aria-label="Play the sound again"
        >
          <span aria-hidden="true" style={{ fontSize: '2.4rem' }}>
            🔊
          </span>
        </button>
      </div>

      {options.length > 0 ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
            gap: 'var(--space-md)',
          }}
        >
          {options.map((option) => {
            const reveal = selected !== null && option.correct;
            const wrong = selected === option.id && !option.correct;
            return (
              <button
                key={option.id}
                onClick={() => void handleSelect(option.id, option.correct)}
                aria-label={option.media?.label ?? option.label}
                aria-pressed={selected === option.id}
                style={{
                  minHeight: 140,
                  borderRadius: 'var(--radius-lg)',
                  background: 'var(--color-surface-alt)',
                  border: `5px solid ${
                    reveal ? 'var(--color-success)' : wrong ? 'var(--color-error)' : 'var(--color-border)'
                  }`,
                  display: 'grid',
                  placeItems: 'center',
                  gap: 6,
                  padding: 'var(--space-sm)',
                }}
              >
                {option.media?.kind === 'image' ? (
                  <img
                    src={option.media.src}
                    alt=""
                    width={88}
                    height={88}
                    style={{ objectFit: 'contain' }}
                    loading="lazy"
                  />
                ) : (
                  <span aria-hidden="true" style={{ fontSize: '2.6rem' }}>
                    🗣️
                  </span>
                )}
                <span style={{ fontWeight: 700 }}>{option.label}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <button
          className="btn btn--large"
          onClick={() => void handleHeard()}
          style={{ justifySelf: 'center' }}
        >
          <span aria-hidden="true">👂</span> I heard it
        </button>
      )}

      <Feedback state={state} />

      {state === 'correct' && (
        <NextButton
          onClick={() => {
            reset();
            onNext();
          }}
        />
      )}
    </div>
  );
}
