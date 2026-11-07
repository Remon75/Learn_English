import { useEffect, useRef, useState } from 'react';
import { playMedia, playTone, createLoudnessMeter } from '../../lib/audio';
import { Feedback, NextButton, type ActivityProps } from './types';

/**
 * Speaking activity.
 *
 * The child taps the microphone, says the phrase, and taps the stop button.
 * A live loudness meter gives visual feedback so the child can see that the
 * app is hearing them even if the audio is quiet.
 *
 * Privacy note: the recording is never uploaded and never stored. The
 * microphone stream is released as soon as the activity ends. At MVP the
 * child (or caregiver) confirms "I said it"; the server stores only the
 * fact that the attempt happened.
 */
export function SpeakActivity({ activity, onResult, onNext }: ActivityProps) {
  const [recording, setRecording] = useState(false);
  const [level, setLevel] = useState(0);
  const [state, setState] = useState<'idle' | 'correct' | 'wrong'>('idle');
  const [permissionError, setPermissionError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const meterRef = useRef<{ level: () => number; stop: () => void } | null>(null);
  const rafRef = useRef<number | null>(null);

  const cleanup = () => {
    meterRef.current?.stop();
    meterRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  useEffect(() => cleanup, []);

  const startRecording = async () => {
    setPermissionError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const meter = createLoudnessMeter(stream);
      meterRef.current = meter;
      setRecording(true);

      const loop = () => {
        setLevel(meter.level());
        rafRef.current = requestAnimationFrame(loop);
      };
      loop();
    } catch {
      setPermissionError(
        'We could not use the microphone. You can still play - tap “I said it”.',
      );
    }
  };

  const stopAndSubmit = async () => {
    cleanup();
    setRecording(false);
    setLevel(0);
    playTone('correct');
    setState('correct');
    await onResult({ response: 'said', score: 1, correct: true });
  };

  return (
    <div style={{ display: 'grid', gap: 'var(--space-md)', justifyItems: 'center' }}>
      {activity.stimulus?.kind === 'audio' && (
        <button className="btn btn--ghost" onClick={() => playMedia(activity.stimulus!)}>
          <span aria-hidden="true">🔊</span> Hear the phrase
        </button>
      )}

      {activity.speakTarget && (
        <p style={{ fontSize: '1.6rem', fontWeight: 700, textAlign: 'center' }}>
          “{activity.speakTarget}”
        </p>
      )}

      <div
        style={{
          width: 160,
          height: 160,
          borderRadius: 'var(--radius-full)',
          background: recording ? 'var(--color-error)' : 'var(--color-secondary)',
          display: 'grid',
          placeItems: 'center',
          color: '#fff',
          fontSize: '3.4rem',
          boxShadow: 'var(--shadow-lg)',
          transform: `scale(${1 + level * 0.18})`,
          transition: 'transform 90ms linear',
        }}
        aria-hidden="true"
      >
        {recording ? '⏺' : '🎤'}
      </div>

      {/* Live loudness meter: a visual channel that works without sound. */}
      <div
        role="meter"
        aria-label="Microphone level"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(level * 100)}
        style={{
          width: '100%',
          maxWidth: 320,
          height: 18,
          borderRadius: 'var(--radius-full)',
          background: 'var(--color-surface-alt)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${level * 100}%`,
            height: '100%',
            background: 'var(--color-success)',
            transition: 'width 90ms linear',
          }}
        />
      </div>

      {permissionError && (
        <p role="alert" style={{ color: 'var(--color-error)', textAlign: 'center' }}>
          {permissionError}
        </p>
      )}

      {!recording ? (
        <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button className="btn btn--large" onClick={() => void startRecording()}>
            <span aria-hidden="true">🎤</span> Start talking
          </button>
          <button className="btn btn--ghost btn--large" onClick={() => void stopAndSubmit()}>
            I said it
          </button>
        </div>
      ) : (
        <button className="btn btn--large" onClick={() => void stopAndSubmit()}>
          <span aria-hidden="true">⏹</span> Stop
        </button>
      )}

      <Feedback state={state} />

      {state === 'correct' && (
        <NextButton
          onClick={() => {
            setState('idle');
            onNext();
          }}
        />
      )}
    </div>
  );
}
