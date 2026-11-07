import { useState } from 'react';
import { playTone } from '../../lib/audio';
import { Feedback, NextButton, type ActivityProps } from './types';

/**
 * Sentence / sequence builder.
 *
 * The child taps word tiles to build a phrase. Tap a placed tile to remove
 * it. The answer is submitted as a pipe-separated sequence so the server can
 * verify the exact order.
 */
export function OrderActivity({ activity, onResult, onNext }: ActivityProps) {
  const tokens = activity.orderTokens ?? [];
  const solution = activity.solution ?? [];

  const [placed, setPlaced] = useState<string[]>([]);
  const [state, setState] = useState<'idle' | 'correct' | 'wrong'>('idle');

  const addToken = (token: string) => {
    if (state === 'correct') return;
    playTone('tap');
    setPlaced((current) => [...current, token]);
  };

  const removeToken = (index: number) => {
    if (state === 'correct') return;
    playTone('tap');
    setPlaced((current) => current.filter((_, i) => i !== index));
  };

  const check = async () => {
    const response = placed.join('|');
    const correct =
      placed.length === solution.length &&
      placed.every((token, i) => token.trim().toLowerCase() === solution[i]?.trim().toLowerCase());

    setState(correct ? 'correct' : 'wrong');
    playTone(correct ? 'correct' : 'wrong');
    await onResult({ response, score: correct ? 1 : 0, correct });
  };

  const reset = () => {
    setPlaced([]);
    setState('idle');
  };

  return (
    <div style={{ display: 'grid', gap: 'var(--space-md)' }}>
      {/* The built sentence. */}
      <div
        aria-label="Your sentence"
        style={{
          minHeight: 88,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 'var(--space-sm)',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'var(--space-sm)',
          borderRadius: 'var(--radius-md)',
          background: 'var(--color-surface-alt)',
          border: '3px dashed var(--color-border)',
        }}
      >
        {placed.length === 0 && (
          <span style={{ color: 'var(--color-text-muted)' }}>Tap the words below</span>
        )}
        {placed.map((token, index) => (
          <button
            key={`${token}-${index}`}
            onClick={() => removeToken(index)}
            aria-label={`Remove ${token}`}
            style={{
              minHeight: 60,
              padding: '0 var(--space-md)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--color-secondary)',
              color: '#fff',
              fontSize: '1.25rem',
              fontWeight: 700,
            }}
          >
            {token}
          </button>
        ))}
      </div>

      {/* The word bank. */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 'var(--space-sm)',
          justifyContent: 'center',
        }}
      >
        {tokens.map((token, index) => (
          <button
            key={`${token}-bank-${index}`}
            onClick={() => addToken(token)}
            aria-label={`Add ${token}`}
            style={{
              minHeight: 60,
              minWidth: 72,
              padding: '0 var(--space-md)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--color-surface)',
              border: '3px solid var(--color-border)',
              fontSize: '1.25rem',
              fontWeight: 700,
            }}
          >
            {token}
          </button>
        ))}
      </div>

      <Feedback
        state={state}
        message={
          state === 'wrong' ? 'Not quite - tap a word to take it back.' : undefined
        }
      />

      <div style={{ display: 'flex', gap: 'var(--space-sm)', justifyContent: 'center', flexWrap: 'wrap' }}>
        <button className="btn btn--ghost" onClick={reset} disabled={placed.length === 0}>
          <span aria-hidden="true">↺</span> Start again
        </button>
        {state !== 'correct' ? (
          <button className="btn" onClick={() => void check()} disabled={placed.length === 0}>
            Check it
          </button>
        ) : (
          <NextButton
            onClick={() => {
              reset();
              onNext();
            }}
          />
        )}
      </div>
    </div>
  );
}
