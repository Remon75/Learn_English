import { useState } from 'react';
import { playMedia, playTone } from '../../lib/audio';
import { Feedback, NextButton, type ActivityProps } from './types';

/**
 * "Choose the right one" activity.
 *
 * Four large picture buttons. Each shows a picture and a word, so a child
 * who cannot read can still match the spoken word to the picture.
 */
export function ChooseActivity({ activity, onResult, onNext }: ActivityProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [state, setState] = useState<'idle' | 'correct' | 'wrong'>('idle');

  const handleSelect = async (optionId: string, correct: boolean) => {
    playTone('tap');
    setSelected(optionId);
    setState(correct ? 'correct' : 'wrong');
    await onResult({ response: optionId, score: correct ? 1 : 0, correct });
  };

  return (
    <div style={{ display: 'grid', gap: 'var(--space-md)' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 'var(--space-md)',
        }}
      >
        {(activity.options ?? []).map((option) => {
          const isSelected = selected === option.id;
          const reveal = selected !== null && option.correct;
          return (
            <button
              key={option.id}
              onClick={() => void handleSelect(option.id, option.correct)}
              aria-label={option.media?.label ?? option.label}
              aria-pressed={isSelected}
              style={{
                minHeight: 160,
                padding: 'var(--space-md)',
                borderRadius: 'var(--radius-lg)',
                background: 'var(--color-surface-alt)',
                border: `5px solid ${
                  reveal
                    ? 'var(--color-success)'
                    : isSelected && !option.correct
                      ? 'var(--color-error)'
                      : 'var(--color-border)'
                }`,
                display: 'grid',
                placeItems: 'center',
                gap: 8,
                boxShadow: reveal || (isSelected && !option.correct) ? 'var(--shadow-md)' : 'none',
                transition: 'border-color 180ms ease',
              }}
            >
              {option.media?.kind === 'image' ? (
                <img
                  src={option.media.src}
                  alt=""
                  width={96}
                  height={96}
                  style={{ objectFit: 'contain' }}
                  loading="lazy"
                />
              ) : (
                <span aria-hidden="true" style={{ fontSize: '3rem' }}>
                  ❓
                </span>
              )}
              <span style={{ fontSize: '1.2rem', fontWeight: 700 }}>{option.label}</span>
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

      {activity.stimulus?.kind === 'audio' && (
        <div style={{ textAlign: 'center' }}>
          <button className="btn btn--ghost" onClick={() => playMedia(activity.stimulus!)}>
            <span aria-hidden="true">🔊</span> Hear the word
          </button>
        </div>
      )}
    </div>
  );
}
