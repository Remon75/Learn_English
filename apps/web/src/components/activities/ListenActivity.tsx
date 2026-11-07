import { useState } from 'react';
import { play, playTone } from '../../lib/audio';
import { Feedback, NextButton, type ActivityProps } from './types';

/**
 * Listening activity.
 *
 * The child hears a word and picks the matching picture. The word is spoken
 * by a locally hosted recording; the Web Speech API is only a fallback when
 * the recording is missing.
 */
export function ListenActivity({ activity, onResult, onNext }: ActivityProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [state, setState] = useState<'idle' | 'correct' | 'wrong'>('idle');

  const stimulus = activity.stimulus;

  const handleSelect = async (optionId: string, correct: boolean) => {
    playTone('tap');
    setSelected(optionId);
    setState(correct ? 'correct' : 'wrong');
    await onResult({ response: optionId, score: correct ? 1 : 0, correct });
  };

  return (
    <div style={{ display: 'grid', gap: 'var(--space-md)' }}>
      <div style={{ textAlign: 'center' }}>
        <button
          className="btn btn--large btn--secondary"
          onClick={() => stimulus && play(stimulus.src)}
          aria-label="Play the sound again"
        >
          <span aria-hidden="true" style={{ fontSize: '2.4rem' }}>
            🔊
          </span>
        </button>
        {stimulus?.transcript && (
          <p style={{ color: 'var(--color-text-muted)', marginTop: 8 }}>{stimulus.transcript}</p>
        )}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
          gap: 'var(--space-md)',
        }}
      >
        {(activity.options ?? []).map((option) => {
          const reveal = selected !== null && option.correct;
          const wrong = selected === option.id && !option.correct;
          return (
            <button
              key={option.id}
              onClick={() => void handleSelect(option.id, option.correct)}
              aria-label={option.media?.label ?? option.label}
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
                <img src={option.media.src} alt="" width={88} height={88} style={{ objectFit: 'contain' }} />
              ) : (
                <span aria-hidden="true" style={{ fontSize: '2.6rem' }}>
                  ❓
                </span>
              )}
              <span style={{ fontWeight: 700 }}>{option.label}</span>
            </button>
          );
        })}
      </div>

      <Feedback state={state} />

      {state === 'correct' && (
        <NextButton
          onClick={() => {
            setSelected(null);
            setState('idle');
            onNext();
          }}
        />
      )}
    </div>
  );
}
