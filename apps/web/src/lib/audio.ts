import { Howl } from 'howler';

/**
 * Audio engine.
 *
 * Howler.js handles playback and the Web Audio API handles synthesis and
 * analysis. Two design rules drive this module:
 *
 *  1. Every sound is loaded from our own origin (`/media/...`). No CDN, no
 *     third-party streaming, no telemetry in the audio stack.
 *  2. Sound is always paired with a visual event. A child who cannot hear
 *     the device, or who has the volume turned down, still gets the same
 *     feedback through the visuals.
 */

export type SoundName = 'tap' | 'correct' | 'wrong' | 'reward' | 'star';

interface ToneSpec {
  frequency: number;
  durationSec: number;
  type: OscillatorType;
}

const TONES: Record<SoundName, ToneSpec> = {
  tap: { frequency: 660, durationSec: 0.08, type: 'sine' },
  correct: { frequency: 880, durationSec: 0.18, type: 'sine' },
  wrong: { frequency: 220, durationSec: 0.22, type: 'triangle' },
  reward: { frequency: 1046, durationSec: 0.35, type: 'sine' },
  star: { frequency: 1568, durationSec: 0.12, type: 'sine' },
};

/** Cached Howl instances, keyed by media path. */
const cache = new Map<string, Howl>();
const enabled = { value: true };

export function setAudioEnabled(value: boolean): void {
  enabled.value = value;
}

export function isAudioEnabled(): boolean {
  return enabled.value;
}

function getHowl(src: string): Howl {
  const existing = cache.get(src);
  if (existing) return existing;

  const howl = new Howl({
    src: [src],
    format: ['mp3', 'ogg', 'wav'],
    preload: true,
    html5: false,
    onloaderror: (_id, error) => {
      // A missing asset must never break the lesson. The visual channel
      // carries the meaning on its own.
      console.warn(`[audio] could not load ${src}:`, error);
    },
  });
  cache.set(src, howl);
  return howl;
}

/** Plays a spoken prompt or sound effect from the local media library. */
export function play(src: string, volume = 1): void {
  if (!enabled.value) return;
  const howl = getHowl(src);
  howl.play();
  if (volume !== 1) howl.volume(volume);
}

/** Speaks text through the Web Speech API when a recorded asset is missing. */
export function speak(text: string, lang = 'en-US'): void {
  if (!enabled.value) return;
  if (typeof speechSynthesis === 'undefined') return;
  try {
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 0.85;
    utterance.pitch = 1.05;
    speechSynthesis.speak(utterance);
  } catch {
    // The Web Speech API is a progressive enhancement, never a requirement.
  }
}

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioContext) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    audioContext = new Ctor();
  }
  return audioContext;
}

/**
 * Plays a short synthesised tone.
 *
 * Reward sounds are generated on the device rather than shipped as files:
 * it keeps the offline bundle small and means no audio ever leaves the
 * machine.
 */
export function playTone(name: SoundName): void {
  if (!enabled.value) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') void ctx.resume();

  const spec = TONES[name];
  const now = ctx.currentTime;
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();

  oscillator.type = spec.type;
  oscillator.frequency.setValueAtTime(spec.frequency, now);
  if (name === 'reward') {
    oscillator.frequency.exponentialRampToValueAtTime(spec.frequency * 1.5, now + spec.durationSec);
  }

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.25, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + spec.durationSec);

  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start(now);
  oscillator.stop(now + spec.durationSec);
}

/** Stops everything. Used when leaving a screen or on a parent lock. */
export function stopAll(): void {
  for (const howl of cache.values()) howl.stop();
  if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
}

/**
 * Measures the loudness of the microphone input.
 *
 * Used for a visual "loudness meter" so a child can see that the app is
 * hearing them. It returns 0..1 and never stores or transmits the audio.
 */
export function createLoudnessMeter(stream: MediaStream): {
  level: () => number;
  stop: () => void;
} {
  const ctx = getAudioContext();
  if (!ctx) return { level: () => 0, stop: () => {} };

  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 256;
  source.connect(analyser);

  const data = new Uint8Array(analyser.frequencyBinCount);
  let current = 0;

  const tick = () => {
    analyser.getByteFrequencyData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i += 1) sum += data[i] ?? 0;
    current = Math.min(1, sum / data.length / 128);
  };

  const interval = window.setInterval(tick, 100);

  return {
    level: () => current,
    stop: () => {
      window.clearInterval(interval);
      source.disconnect();
      analyser.disconnect();
    },
  };
}
