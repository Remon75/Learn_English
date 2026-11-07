import { useState } from 'react';
import { useAppStore, AVATAR_IDS } from '../store/app';
import { playTone } from '../lib/audio';

const AVATARS: Record<string, { emoji: string; label: string }> = {
  fox: { emoji: '🦊', label: 'Fox' },
  owl: { emoji: '🦉', label: 'Owl' },
  panda: { emoji: '🐼', label: 'Panda' },
  cat: { emoji: '🐱', label: 'Cat' },
  frog: { emoji: '🐸', label: 'Frog' },
  bear: { emoji: '🐻', label: 'Bear' },
};

const AGE_BANDS = [
  { id: '3-4', label: '3 - 4 years' },
  { id: '5-6', label: '5 - 6 years' },
  { id: '7-8', label: '7 - 8 years' },
];

/**
 * Onboarding.
 *
 * There is no email, no password, no social sign-in and no advertising SDK.
 * A caregiver picks an avatar and a 4-digit PIN in under twenty seconds and
 * the child is playing. The PIN is a household gate, not an identity system.
 */
export function WelcomeScreen() {
  const createProfile = useAppStore((s) => s.createProfile);
  const setError = useAppStore((s) => s.setError);

  const [nickname, setNickname] = useState('');
  const [avatarId, setAvatarId] = useState<string>('fox');
  const [ageBand, setAgeBand] = useState<string>('3-4');
  const [pin, setPin] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (pin.length !== 4) {
      setError('Please choose a 4-digit parent PIN.');
      return;
    }
    setSubmitting(true);
    try {
      await createProfile({
        ...(nickname.trim() ? { nickname: nickname.trim() } : {}),
        avatarId,
        ageBand,
        caregiverPin: pin,
      });
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not create the profile.');
    } finally {
      setSubmitting(false);
    }
  };

  const selectAvatar = (id: string) => {
    setAvatarId(id);
    playTone('tap');
  };

  return (
    <div
      className="animate-fade"
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: 'var(--space-lg) var(--space-md)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 'var(--space-lg)',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <div className="animate-bounce" style={{ fontSize: '4.5rem' }} aria-hidden="true">
          ✨
        </div>
        <h1 style={{ fontSize: '2.4rem', color: 'var(--color-primary-dark)' }}>Sparkle English</h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '1.1rem', marginTop: 8 }}>
          A private English adventure that lives entirely on this device.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="card"
        style={{ width: '100%', maxWidth: 480, display: 'grid', gap: 'var(--space-lg)' }}
      >
        <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
          <legend
            style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', marginBottom: 12 }}
          >
            Pick your friend
          </legend>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-sm)' }}>
            {AVATAR_IDS.map((id) => {
              const avatar = AVATARS[id]!;
              const selected = avatarId === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => selectAvatar(id)}
                  aria-pressed={selected}
                  aria-label={avatar.label}
                  style={{
                    width: 76,
                    height: 76,
                    fontSize: '2.6rem',
                    borderRadius: 'var(--radius-full)',
                    background: selected ? 'var(--color-star)' : 'var(--color-surface-alt)',
                    border: selected
                      ? '4px solid var(--color-primary-dark)'
                      : '4px solid transparent',
                    boxShadow: selected ? 'var(--shadow-md)' : 'none',
                    display: 'grid',
                    placeItems: 'center',
                  }}
                >
                  <span aria-hidden="true">{avatar.emoji}</span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <label style={{ display: 'grid', gap: 8 }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem' }}>
            Name (optional)
          </span>
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={24}
            placeholder="A first name or nickname"
            style={{
              minHeight: 56,
              padding: '0 var(--space-md)',
              fontSize: '1.2rem',
              borderRadius: 'var(--radius-md)',
              border: '3px solid var(--color-border)',
              background: 'var(--color-surface-alt)',
              color: 'var(--color-text)',
              fontFamily: 'inherit',
            }}
          />
        </label>

        <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
          <legend
            style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', marginBottom: 12 }}
          >
            How old is your child?
          </legend>
          <div style={{ display: 'grid', gap: 'var(--space-sm)' }}>
            {AGE_BANDS.map((band) => {
              const selected = ageBand === band.id;
              return (
                <button
                  key={band.id}
                  type="button"
                  onClick={() => {
                    setAgeBand(band.id);
                    playTone('tap');
                  }}
                  aria-pressed={selected}
                  style={{
                    minHeight: 56,
                    padding: '0 var(--space-md)',
                    fontSize: '1.15rem',
                    textAlign: 'left',
                    borderRadius: 'var(--radius-md)',
                    background: selected ? 'var(--color-secondary)' : 'var(--color-surface-alt)',
                    color: selected ? '#fff' : 'var(--color-text)',
                    border: selected
                      ? '3px solid var(--color-secondary)'
                      : '3px solid var(--color-border)',
                    fontWeight: selected ? 700 : 500,
                  }}
                >
                  {band.label}
                </button>
              );
            })}
          </div>
        </fieldset>

        <label style={{ display: 'grid', gap: 8 }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem' }}>
            Parent PIN (4 digits)
          </span>
          <span style={{ fontSize: '0.95rem', color: 'var(--color-text-muted)' }}>
            Protects the grown-up settings. Keep it secret and easy for you to remember.
          </span>
          <input
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            inputMode="numeric"
            pattern="\d{4}"
            maxLength={4}
            aria-describedby="pin-help"
            style={{
              minHeight: 64,
              padding: '0 var(--space-md)',
              fontSize: '2rem',
              letterSpacing: '0.5em',
              textAlign: 'center',
              borderRadius: 'var(--radius-md)',
              border: '3px solid var(--color-border)',
              background: 'var(--color-surface-alt)',
              color: 'var(--color-text)',
              fontFamily: 'inherit',
            }}
          />
        </label>

        <button className="btn btn--large" type="submit" disabled={submitting}>
          {submitting ? 'Starting…' : 'Let’s play!'}
        </button>

        <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', margin: 0, textAlign: 'center' }}>
          No account, no email, no ads, no data leaves this device.
        </p>
      </form>
    </div>
  );
}
