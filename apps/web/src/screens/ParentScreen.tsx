import { useState } from 'react';
import type { ParentSettings, TeacherReport } from '@sparkle/shared';
import { api } from '../lib/api';
import { useAppStore } from '../store/app';
import { purgeAll } from '../lib/offline';
import { setAudioEnabled } from '../lib/audio';

/**
 * The caregiver console.
 *
 * Everything here is behind the 4-digit PIN. It shows aggregate progress,
 * exposes the safety controls, allows a JSON export, and offers a one-way
 * erasure. There is no advertising toggle, no "engagement" optimiser and
 * no data-selling option, because none of those exist in the product.
 */
export function ParentScreen() {
  const setScreen = useAppStore((s) => s.setScreen);
  const setError = useAppStore((s) => s.setError);
  const signOut = useAppStore((s) => s.signOut);

  const [pin, setPin] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [settings, setSettings] = useState<ParentSettings | null>(null);
  const [report, setReport] = useState<TeacherReport | null>(null);
  const [days, setDays] = useState(7);
  const [busy, setBusy] = useState(false);
  const [confirmErase, setConfirmErase] = useState(false);

  const unlock = async () => {
    setBusy(true);
    try {
      const [settingsResult, reportResult] = await Promise.all([
        api.getSettings(pin),
        api.getReport(pin, days),
      ]);
      setSettings(settingsResult.settings);
      setReport(reportResult.report);
      setUnlocked(true);
      setAudioEnabled(settingsResult.settings.audioEnabled);
    } catch {
      setError('That PIN is not correct.');
    } finally {
      setBusy(false);
    }
  };

  const update = async (patch: Partial<ParentSettings>) => {
    if (!settings) return;
    try {
      const result = await api.updateSettings(pin, patch);
      setSettings(result.settings);
      setAudioEnabled(result.settings.audioEnabled);
    } catch {
      setError('Could not save that setting.');
    }
  };

  const erase = async () => {
    setBusy(true);
    try {
      await api.deleteProfile(pin);
      await purgeAll();
      signOut();
    } catch {
      setError('Could not delete the profile.');
      setBusy(false);
    }
  };

  if (!unlocked) {
    return (
      <div
        style={{
          flex: 1,
          display: 'grid',
          placeContent: 'center',
          justifyItems: 'center',
          gap: 'var(--space-md)',
          padding: 'var(--space-lg)',
        }}
      >
        <button
          className="btn btn--ghost"
          onClick={() => setScreen('map')}
          style={{ position: 'absolute', top: 16, left: 16 }}
        >
          <span aria-hidden="true">←</span> Back
        </button>

        <h1 style={{ fontSize: '2rem' }}>Grown-ups only</h1>
        <p style={{ color: 'var(--color-text-muted)', textAlign: 'center', maxWidth: 380 }}>
          Enter your 4-digit PIN to see settings and progress.
        </p>

        <input
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
          inputMode="numeric"
          maxLength={4}
          aria-label="Caregiver PIN"
          style={{
            minHeight: 72,
            width: 220,
            fontSize: '2.2rem',
            letterSpacing: '0.5em',
            textAlign: 'center',
            borderRadius: 'var(--radius-md)',
            border: '3px solid var(--color-border)',
            background: 'var(--color-surface)',
            fontFamily: 'inherit',
          }}
        />

        <button className="btn btn--large" onClick={() => void unlock()} disabled={pin.length !== 4 || busy}>
          {busy ? 'Checking…' : 'Unlock'}
        </button>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-md)' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)' }}>
        <button className="btn btn--ghost" onClick={() => setScreen('map')} aria-label="Back to the map">
          <span aria-hidden="true">←</span>
        </button>
        <h1 style={{ fontSize: '1.8rem' }}>Grown-up dashboard</h1>
      </header>

      {report && (
        <section className="card" style={{ marginBottom: 'var(--space-lg)', display: 'grid', gap: 'var(--space-md)' }}>
          <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
            {[7, 30, 90].map((option) => (
              <button
                key={option}
                className={days === option ? 'btn' : 'btn btn--ghost'}
                onClick={async () => {
                  setDays(option);
                  try {
                    const result = await api.getReport(pin, option);
                    setReport(result.report);
                  } catch {
                    setError('Could not refresh the report.');
                  }
                }}
              >
                {option} days
              </button>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 'var(--space-md)' }}>
            <Stat label="Minutes" value={report.minutesLearned} />
            <Stat label="Sessions" value={report.sessionsCompleted} />
            <Stat label="Lessons done" value={report.lessonsCompleted} />
            <Stat label="Stars" value={report.starsEarned} />
          </div>

          {report.strengths.length > 0 && (
            <p>
              <strong>Strongest areas:</strong>{' '}
              {report.strengths.map((s) => s.replace('-', ' ')).join(', ')}
            </p>
          )}
          {report.focusAreas.length > 0 && (
            <p>
              <strong>Worth practising:</strong>{' '}
              {report.focusAreas.map((s) => s.replace('-', ' ')).join(', ')}
            </p>
          )}
        </section>
      )}

      {settings && (
        <section className="card" style={{ marginBottom: 'var(--space-lg)', display: 'grid', gap: 'var(--space-md)' }}>
          <h2 style={{ fontSize: '1.4rem' }}>Settings</h2>

          <Toggle
            label="Sound effects and audio"
            hint="Turn off to silence the app completely."
            checked={settings.audioEnabled}
            onChange={(value) => void update({ audioEnabled: value })}
          />

          <Toggle
            label="Microphone for speaking practice"
            hint="Recordings stay on this device and are never uploaded or stored."
            checked={settings.microphoneEnabled}
            onChange={(value) => void update({ microphoneEnabled: value })}
          />

          <Toggle
            label="Offline lesson downloads"
            hint="Allow lessons to be cached for use without a connection."
            checked={settings.offlineDownloadsEnabled}
            onChange={(value) => void update({ offlineDownloadsEnabled: value })}
          />

          <Toggle
            label="Require approval before sharing"
            hint="Any export or sharing needs an adult to confirm first."
            checked={settings.sharingRequiresApproval}
            onChange={(value) => void update({ sharingRequiresApproval: value })}
          />

          <Toggle
            label="Allow outbound network requests"
            hint="Off by default. The app is designed to work with no network at all."
            checked={settings.allowOutboundNetwork}
            onChange={(value) => void update({ allowOutboundNetwork: value })}
          />

          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontWeight: 700 }}>Daily time limit (minutes)</span>
            <span style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>
              0 means no limit. A limit pauses the app with a calm screen; it never
              removes earned stars or badges.
            </span>
            <input
              type="number"
              min={0}
              max={180}
              value={settings.dailyLimitMinutes}
              onChange={(e) => void update({ dailyLimitMinutes: Number(e.target.value) || 0 })}
              style={{
                minHeight: 56,
                padding: '0 var(--space-md)',
                fontSize: '1.2rem',
                borderRadius: 'var(--radius-md)',
                border: '3px solid var(--color-border)',
                fontFamily: 'inherit',
              }}
            />
          </label>
        </section>
      )}

      <section className="card" style={{ display: 'grid', gap: 'var(--space-md)' }}>
        <h2 style={{ fontSize: '1.4rem' }}>Your data</h2>
        <p style={{ color: 'var(--color-text-muted)', margin: 0 }}>
          Everything about this profile is stored in one local database file on this
          device. Nothing is sent to a server, an analytics service or an advertiser -
          because none of those exist in this product.
        </p>

        <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
          <button
            className="btn btn--ghost"
            onClick={() => {
              void import('../lib/api').then(async ({ api }) => {
                try {
                  const response = await fetch('/api/v1/parent/export', {
                    headers: {
                      'x-device-token': localStorage.getItem('sparkle.deviceToken') ?? '',
                      'x-caregiver-pin': pin,
                    },
                  });
                  const blob = await response.blob();
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement('a');
                  link.href = url;
                  link.download = 'sparkle-export.json';
                  link.click();
                  URL.revokeObjectURL(url);
                } catch {
                  setError('Could not export the data.');
                }
                void api;
              });
            }}
          >
            <span aria-hidden="true">⬇️</span> Export as JSON
          </button>

          <button
            className="btn btn--ghost"
            onClick={() => setConfirmErase(true)}
            style={{ color: 'var(--color-error)' }}
          >
            <span aria-hidden="true">🗑️</span> Delete all data
          </button>
        </div>

        {confirmErase && (
          <div
            className="card"
            style={{ background: '#ffebee', border: '3px solid var(--color-error)' }}
            role="alertdialog"
            aria-label="Confirm delete"
          >
            <p style={{ marginTop: 0 }}>
              This permanently deletes the profile, progress, stars and badges from this
              device. It cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
              <button className="btn" style={{ background: 'var(--color-error)' }} onClick={() => void erase()} disabled={busy}>
                Yes, delete everything
              </button>
              <button className="btn btn--ghost" onClick={() => setConfirmErase(false)}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>

      <div style={{ marginTop: 'var(--space-lg)', display: 'flex', gap: 'var(--space-sm)', justifyContent: 'center' }}>
        <button className="btn btn--ghost" onClick={() => setScreen('map')}>
          Back to the map
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{
        background: 'var(--color-surface-alt)',
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-md)',
        textAlign: 'center',
      }}
    >
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '2rem' }}>{value}</div>
      <div style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>{label}</div>
    </div>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label
      style={{
        display: 'flex',
        gap: 'var(--space-md)',
        alignItems: 'flex-start',
        cursor: 'pointer',
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ width: 28, height: 28, marginTop: 2, flexShrink: 0 }}
      />
      <span>
        <span style={{ display: 'block', fontWeight: 700 }}>{label}</span>
        <span style={{ display: 'block', fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>
          {hint}
        </span>
      </span>
    </label>
  );
}
