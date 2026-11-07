import { useState } from 'react';
import { playMedia, playTone } from '../../lib/audio';
import { Feedback, NextButton, type ActivityProps } from './types';

/**
 * Match activity.
 *
 * The child taps one card on the left and one on the right. A correct pair
 * locks in with a chime and both cards fade to a "done" state. The answer
 * is sent as "leftId=rightId,leftId=rightId" so the server can verify it
 * without trusting the client.
 */
export function MatchActivity({ activity, onResult, onNext }: ActivityProps) {
  const pairs = activity.pairs ?? [];
  const [pickedLeft, setPickedLeft] = useState<string | null>(null);
  const [matched, setMatched] = useState<string[]>([]);
  const [wrongPair, setWrongPair] = useState(false);
  const [finished, setFinished] = useState(false);

  const handleRight = async (pairId: string, rightId: string) => {
    if (!pickedLeft) return;
    playTone('tap');

    if (pickedLeft === pairId) {
      const next = [...matched, pairId];
      setMatched(next);
      setPickedLeft(null);
      setWrongPair(false);
      playTone('correct');

      if (next.length === pairs.length) {
        setFinished(true);
        const response = pairs.map((p) => `${p.id}=${rightIdFor(p.id, pairs)}`).join(',');
        await onResult({ response, score: 1, correct: true });
      }
      return;
    }

    setWrongPair(true);
    playTone('wrong');
    await onResult({ response: `${pickedLeft}=${rightId}`, score: 0, correct: false });
    window.setTimeout(() => {
      setWrongPair(false);
      setPickedLeft(null);
    }, 700);
  };

  return (
    <div style={{ display: 'grid', gap: 'var(--space-md)' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 'var(--space-md)',
        }}
      >
        <div style={{ display: 'grid', gap: 'var(--space-sm)' }}>
          {pairs.map((pair) => {
            const isMatched = matched.includes(pair.id);
            const isPicked = pickedLeft === pair.id;
            return (
              <button
                key={`left-${pair.id}`}
                onClick={() => {
                  if (isMatched) return;
                  playTone('tap');
                  setPickedLeft(pair.id);
                }}
                aria-label={pair.left.label}
                aria-pressed={isPicked}
                disabled={isMatched}
                style={{
                  minHeight: 96,
                  borderRadius: 'var(--radius-md)',
                  background: isMatched
                    ? 'rgba(46,125,50,0.14)'
                    : isPicked
                      ? 'var(--color-star)'
                      : 'var(--color-surface-alt)',
                  border: `4px solid ${
                    isMatched
                      ? 'var(--color-success)'
                      : isPicked
                        ? 'var(--color-primary-dark)'
                        : 'var(--color-border)'
                  }`,
                  opacity: isMatched ? 0.6 : 1,
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                {pair.left.kind === 'image' ? (
                  <img src={pair.left.src} alt="" width={64} height={64} style={{ objectFit: 'contain' }} />
                ) : (
                  <span aria-hidden="true" style={{ fontSize: '2rem' }}>
                    🔊
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div style={{ display: 'grid', gap: 'var(--space-sm)' }}>
          {pairs.map((pair) => {
            const isMatched = matched.includes(pair.id);
            return (
              <button
                key={`right-${pair.id}`}
                onClick={() => void handleRight(pair.id, pair.right.src)}
                aria-label={pair.right.label}
                disabled={isMatched}
                style={{
                  minHeight: 96,
                  borderRadius: 'var(--radius-md)',
                  background: isMatched
                    ? 'rgba(46,125,50,0.14)'
                    : wrongPair
                      ? 'rgba(198,40,40,0.18)'
                      : 'var(--color-surface-alt)',
                  border: `4px solid ${
                    isMatched ? 'var(--color-success)' : wrongPair ? 'var(--color-error)' : 'var(--color-border)'
                  }`,
                  opacity: isMatched ? 0.6 : 1,
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: '1.1rem',
                  fontWeight: 700,
                }}
              >
                {pair.right.kind === 'image' ? (
                  <img src={pair.right.src} alt="" width={64} height={64} style={{ objectFit: 'contain' }} />
                ) : (
                  <span>
                    <span aria-hidden="true">🔊 </span>
                    {pair.right.label}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <Feedback state={finished ? 'correct' : wrongPair ? 'wrong' : 'idle'} />

      {finished && (
        <NextButton
          onClick={() => {
            setMatched([]);
            setFinished(false);
            setPickedLeft(null);
            onNext();
          }}
        />
      )}

      {activity.pairs?.[0]?.right.kind === 'audio' && (
        <div style={{ textAlign: 'center' }}>
          <button className="btn btn--ghost" onClick={() => playMedia(activity.pairs![0]!.right)}>
            <span aria-hidden="true">🔊</span> Hear it again
          </button>
        </div>
      )}
    </div>
  );
}

/** Finds the right-hand media path for a pair id. */
function rightIdFor(pairId: string, pairs: Array<{ id: string; right: { src: string } }>): string {
  return pairs.find((p) => p.id === pairId)?.right.src ?? '';
}
