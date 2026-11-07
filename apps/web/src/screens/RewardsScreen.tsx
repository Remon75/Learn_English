import { useEffect, useState } from 'react';
import { BADGES, type AwardedBadge, type ChildProgress } from '@sparkle/shared';
import { api } from '../lib/api';
import { useAppStore } from '../store/app';
import { playTone } from '../lib/audio';

const BADGE_ICONS: Record<string, string> = {
  sprout: '🌱',
  spark: '✨',
  star: '⭐',
  stars: '🌟',
  galaxy: '🌌',
  ear: '👂',
  abc: '🔤',
  wand: '🪄',
  blocks: '🧱',
  puzzle: '🧩',
  mic: '🎤',
  calendar: '📅',
};

/**
 * The rewards screen.
 *
 * Badges that have not been earned are shown greyed out but still visible.
 * Hiding them would remove the child's goal; showing them greyed keeps the
 * reward visible without any nagging or urgency.
 */
export function RewardsScreen() {
  const setScreen = useAppStore((s) => s.setScreen);
  const childId = useAppStore((s) => s.childId);
  const totalStars = useAppStore((s) => s.totalStars);
  const [progress, setProgress] = useState<ChildProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // The rewards screen is reachable by children, but the progress data
    // lives behind the caregiver PIN. We show what is already public (stars
    // and earned badges from the session) and ask for the PIN for detail.
    if (!childId) return;
    void requestPinAndLoad();
  }, [childId]);

  const requestPinAndLoad = async () => {
    const pin = window.prompt('Grown-ups: enter your 4-digit PIN to see your badges.');
    if (!pin) return;
    try {
      const result = await api.getProgress(pin);
      setProgress(result.progress);
    } catch {
      setError('That PIN is not correct.');
    }
  };

  const awarded: AwardedBadge[] = progress?.badges ?? [];
  const awardedIds = new Set(awarded.map((b) => b.badgeId));

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-md)' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-md)',
          marginBottom: 'var(--space-lg)',
        }}
      >
        <button
          className="btn btn--ghost"
          onClick={() => setScreen('map')}
          aria-label="Back to the map"
        >
          <span aria-hidden="true">←</span>
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: '1.8rem' }}>My badges</h1>
          <p style={{ color: 'var(--color-text-muted)', margin: '4px 0 0' }}>
            You have collected {totalStars} stars
          </p>
        </div>
      </header>

      {error && (
        <p role="alert" style={{ color: 'var(--color-error)' }}>
          {error}
        </p>
      )}

      {!progress && !error && (
        <div className="card" style={{ textAlign: 'center' }}>
          <p>Some badges are kept secret until a grown-up unlocks them.</p>
          <button className="btn" onClick={() => void requestPinAndLoad()}>
            Unlock badges
          </button>
        </div>
      )}

      {progress && (
        <ul
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
            gap: 'var(--space-md)',
          }}
        >
          {BADGES.map((badge) => {
            const earned = awardedIds.has(badge.id);
            return (
              <li
                key={badge.id}
                className={earned ? 'animate-pop' : undefined}
                style={{
                  background: 'var(--color-surface)',
                  borderRadius: 'var(--radius-lg)',
                  padding: 'var(--space-md)',
                  textAlign: 'center',
                  boxShadow: 'var(--shadow-md)',
                  opacity: earned ? 1 : 0.42,
                  filter: earned ? 'none' : 'grayscale(1)',
                }}
              >
                <div aria-hidden="true" style={{ fontSize: '3rem' }}>
                  {BADGE_ICONS[badge.icon] ?? '🏅'}
                </div>
                <h2 style={{ fontSize: '1.15rem', marginTop: 6 }}>{badge.title}</h2>
                <p style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)', margin: '4px 0 0' }}>
                  {earned ? badge.description : 'Keep playing to unlock this one.'}
                </p>
                {earned && (
                  <p style={{ fontSize: '0.8rem', color: 'var(--color-success)', margin: '6px 0 0' }}>
                    ✓ Earned
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {progress && (
        <section style={{ marginTop: 'var(--space-xl)' }}>
          <h2 style={{ fontSize: '1.4rem', marginBottom: 'var(--space-sm)' }}>What I am good at</h2>
          <div className="card" style={{ display: 'grid', gap: 'var(--space-sm)' }}>
            {Object.entries(progress.skillMastery)
              .sort((a, b) => b[1] - a[1])
              .map(([skill, value]) => (
                <div key={skill} style={{ display: 'grid', gap: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ textTransform: 'capitalize', fontWeight: 700 }}>{skill}</span>
                    <span style={{ color: 'var(--color-text-muted)' }}>
                      {Math.round(value * 100)}%
                    </span>
                  </div>
                  <div
                    role="meter"
                    aria-label={`${skill} mastery`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(value * 100)}
                    style={{
                      height: 16,
                      borderRadius: 'var(--radius-full)',
                      background: 'var(--color-surface-alt)',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${value * 100}%`,
                        height: '100%',
                        background:
                          value >= 0.8
                            ? 'var(--color-success)'
                            : value >= 0.5
                              ? 'var(--color-star)'
                              : 'var(--color-primary)',
                      }}
                    />
                  </div>
                </div>
              ))}
          </div>
        </section>
      )}

      <div style={{ marginTop: 'var(--space-lg)', textAlign: 'center' }}>
        <button className="btn btn--ghost" onClick={() => playTone('tap')}>
          <span aria-hidden="true">🔊</span> Tap for a sound
        </button>
      </div>
    </div>
  );
}
