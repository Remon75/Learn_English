#!/usr/bin/env node
/**
 * Generates the local media library.
 *
 * Every asset is produced from code so the repository carries no
 * third-party binaries and the whole app can be rebuilt offline. Audio is
 * synthesised as WAV; images are written as SVG.
 *
 * Usage: node scripts/generate-media.mjs
 */
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const mediaDir = resolve(here, '../apps/web/public/media');

mkdirSync(resolve(mediaDir, 'audio'), { recursive: true });
mkdirSync(resolve(mediaDir, 'img'), { recursive: true });

/* ------------------------------ Audio ------------------------------ */

/**
 * Synthesises a spoken-word placeholder tone.
 *
 * These are intentionally simple tones, not speech: the project ships with
 * a documented pipeline for recording or generating real narration (see
 * docs/ASSETS.md). The placeholders let the whole product run and be
 * tested before any voice assets exist.
 */
function writeWav(path, frequencies, durationSec = 0.7, sampleRate = 22050) {
  const samples = Math.floor(sampleRate * durationSec);
  const data = Buffer.alloc(samples * 2);

  // Accept either [440, 523] or [[440, 1], [523, 0.6]].
  const partials = frequencies.map((entry) =>
    Array.isArray(entry) ? entry : [entry, 1],
  );

  for (let i = 0; i < samples; i += 1) {
    const t = i / sampleRate;
    const envelope = Math.min(1, t * 12) * Math.min(1, (durationSec - t) * 8);

    let sample = 0;
    for (const [freq, weight] of partials) {
      sample += Math.sin(2 * Math.PI * freq * t) * weight;
    }
    // Light vibrato so the tones sound friendlier and less like a test tone.
    const vibrato = 1 + 0.02 * Math.sin(2 * Math.PI * 5 * t);
    const value = Math.max(-1, Math.min(1, sample * envelope * 0.4 * vibrato));
    data.writeInt16LE(Math.round(value * 32767), i * 2);
  }

  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);

  writeFileSync(path, Buffer.concat([header, data]));
}

const audioLibrary = {
  hello: [523, 659],
  goodbye: [440, 392],
  mum: [587],
  dad: [494],
  sister: [659, 784],
  brother: [523, 587],
  red: [659],
  blue: [494],
  green: [587, 659],
  yellow: [784],
  cat: [659, 784],
  dog: [392, 523],
  sun: [784],
  'letter-a': [523, 659, 784],
  'letter-b': [494, 587, 659],
  'letter-c': [523, 587],
  'letter-d': [494, 587],
  'letter-e': [440, 587],
  'letter-f': [349, 440],
  'letter-g': [392, 523],
  'letter-h': [440, 523],
  'letter-i': [523, 659],
  'letter-j': [494, 659],
  'letter-k': [523, 698],
  'letter-l': [440, 587],
  'letter-m': [392, 523, 659],
  'letter-n': [440, 587, 698],
  'letter-o': [523, 659, 784],
  'letter-p': [494, 659, 784],
  'letter-q': [587, 698],
  'letter-r': [523, 698],
  'letter-s': [659, 784],
  'letter-t': [440, 523],
  'letter-u': [523, 698],
  'letter-v': [494, 587],
  'letter-w': [392, 523, 659],
  'letter-x': [587, 784],
  'letter-y': [523, 659],
  'letter-z': [440, 523],
  'word-cat': [659, 784],
  'word-dog': [392, 523],
  'word-fish': [349, 440],
  'word-sun': [784, 880],
  'word-cup': [587],
  'word-bed': [494],
  'word-door': [523],
  'word-lamp': [659],
  'animal-moo': [220, 262],
  'pronoun-she': [587, 659],
  'pronoun-we': [523, 587],
  'sentence-dog-runs': [392, 523, 587],
  'family-animals': [659, 587, 523, 494],
  'story-lost-duck': [523, 587, 659, 523],
};

for (const [name, frequencies] of Object.entries(audioLibrary)) {
  const isStory = name.startsWith('story-');
  writeWav(
    resolve(mediaDir, 'audio', `${name}.wav`),
    frequencies,
    isStory ? 2.4 : 0.7,
  );
}

// Lesson announcements reuse the letter tones so the map has audio.
writeWav(resolve(mediaDir, 'audio', 'lesson-l1-u1-s1.wav'), [523, 659, 784], 1.2);

/* ------------------------------ Images ------------------------------ */

const PALETTE = {
  red: '#E53935',
  blue: '#1E88E5',
  green: '#43A047',
  yellow: '#FDD835',
  orange: '#FB8C00',
  purple: '#8E24AA',
  pink: '#D81B60',
  brown: '#6D4C41',
  grey: '#90A4AE',
  skin: '#FFCCBC',
  white: '#FFFFFF',
};

function svgFile(name, markup) {
  writeFileSync(resolve(mediaDir, 'img', `${name}.svg`), markup, 'utf8');
}

function circle(name, fill) {
  svgFile(
    name,
    `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><circle cx="100" cy="100" r="88" fill="${fill}"/></svg>`,
  );
}

function animal(name, body, ear) {
  svgFile(
    name,
    `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
      <ellipse cx="100" cy="120" rx="70" ry="55" fill="${body}"/>
      <circle cx="100" cy="65" r="42" fill="${body}"/>
      <ellipse cx="72" cy="35" rx="16" ry="26" fill="${ear}" transform="rotate(-20 72 35)"/>
      <ellipse cx="128" cy="35" rx="16" ry="26" fill="${ear}" transform="rotate(20 128 35)"/>
      <circle cx="85" cy="60" r="7" fill="#1B1B1B"/>
      <circle cx="115" cy="60" r="7" fill="#1B1B5C"/>
      <ellipse cx="100" cy="78" rx="9" ry="7" fill="#1B1B1B"/>
    </svg>`,
  );
}

// Colour balls
for (const [name, colour] of Object.entries({
  'ball-red': PALETTE.red,
  'ball-blue': PALETTE.blue,
  'ball-green': PALETTE.green,
  'ball-yellow': PALETTE.yellow,
})) {
  circle(name, colour);
}

// Shapes
svgFile(
  'shape-circle',
  `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><circle cx="100" cy="100" r="80" fill="${PALETTE.blue}"/></svg>`,
);
svgFile(
  'shape-square',
  `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect x="24" y="24" width="152" height="152" rx="16" fill="${PALETTE.orange}"/></svg>`,
);
svgFile(
  'shape-triangle',
  `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><polygon points="100,20 180,170 20,170" fill="${PALETTE.green}"/></svg>`,
);

// Family members
animal('mum', PALETTE.pink, PALETTE.purple);
animal('dad', PALETTE.blue, PALETTE.brown);
animal('sister', PALETTE.purple, PALETTE.pink);
animal('brother', PALETTE.green, PALETTE.blue);
animal('cat', PALETTE.orange, PALETTE.orange);
animal('dog', PALETTE.brown, PALETTE.brown);
animal('pig', PALETTE.pink, PALETTE.pink);
animal('duck', PALETTE.yellow, PALETTE.yellow);
animal('cow', PALETTE.grey, PALETTE.white);
animal('hen', PALETTE.red, PALETTE.red);
animal('bird', PALETTE.blue, PALETTE.blue);
animal('bat', PALETTE.brown, PALETTE.brown);

// Everyday objects
const objects = {
  cup: PALETTE.red,
  bed: PALETTE.purple,
  door: PALETTE.brown,
  lamp: PALETTE.yellow,
  apple: PALETTE.red,
  carrot: PALETTE.orange,
  bus: PALETTE.yellow,
  sun: PALETTE.yellow,
  box: PALETTE.brown,
};
for (const [name, colour] of Object.entries(objects)) {
  circle(name, colour);
}

// Rooms
for (const [name, colour] of Object.entries({
  'room-kitchen': PALETTE.yellow,
  'room-bathroom': PALETTE.blue,
  'room-garden': PALETTE.green,
})) {
  circle(name, colour);
}

// Moods
for (const [name, colour] of Object.entries({
  'mood-happy': PALETTE.yellow,
  'mood-sad': PALETTE.blue,
  'mood-angry': PALETTE.red,
})) {
  circle(name, colour);
}

// Hand and wave
circle('hand', PALETTE.skin);
circle('foot', PALETTE.skin);
circle('wave', PALETTE.skin);

// Letters (A-Z) - vector glyphs generated from a simple stroke font.
const LETTER_PATHS = {
  a: 'M40 150 L80 40 L120 150 M55 115 L105 115',
  b: 'M45 30 L45 150 M45 90 Q90 70 115 95 Q140 125 105 145 Q70 160 45 140',
  c: 'M120 65 Q90 40 60 65 Q30 95 60 130 Q90 155 120 130',
  d: 'M115 30 L115 150 M115 90 Q75 70 50 95 Q25 125 55 145 Q90 160 115 140',
  e: 'M45 95 L120 95 Q125 60 90 50 Q50 45 40 95 Q30 140 75 148 Q100 152 120 135',
  f: 'M110 35 Q60 25 60 80 L60 150 M40 80 L100 80',
  g: 'M120 65 Q85 40 55 70 Q30 100 60 120 Q95 140 118 110 L118 150 Q100 165 70 150',
  h: 'M45 30 L45 150 M45 90 Q85 65 110 90 L110 150',
  i: 'M80 60 L80 150 M80 35 L80 40',
  j: 'M105 60 L105 140 Q95 165 65 150 M105 35 L105 40',
  k: 'M45 30 L45 150 M115 60 L45 105 M75 90 L120 150',
  l: 'M70 30 L70 150',
  m: 'M35 150 L35 60 M35 85 Q65 60 85 85 L85 150 M85 85 Q115 60 135 85 L135 150',
  n: 'M40 150 L40 60 M40 95 Q75 60 110 90 L110 150',
  o: 'M80 45 Q125 45 125 100 Q125 155 80 155 Q35 155 35 100 Q35 45 80 45',
  p: 'M45 60 L45 175 M45 95 Q85 65 115 90 Q140 120 105 142 Q70 160 45 140',
  q: 'M80 45 Q125 45 125 100 Q125 155 80 155 Q35 155 35 100 Q35 45 80 45 M95 125 L135 175',
  r: 'M45 150 L45 60 M45 95 Q80 55 120 70',
  s: 'M115 65 Q85 45 55 65 Q30 90 80 100 Q125 112 105 138 Q80 160 45 138',
  t: 'M80 30 L80 125 Q80 150 115 145 M40 60 L115 60',
  u: 'M40 60 L40 115 Q40 155 80 150 Q110 145 120 115 L120 60 M120 115 L120 150',
  v: 'M40 60 L80 150 L120 60',
  w: 'M30 60 L55 150 L80 85 L105 150 L130 60',
  x: 'M40 60 L120 150 M120 60 L40 150',
  y: 'M40 60 L80 120 M120 60 L65 175',
  z: 'M40 60 L120 60 L45 150 L120 150',
};

for (const [letter, path] of Object.entries(LETTER_PATHS)) {
  svgFile(
    `letter-${letter}`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 160 200">
      <path d="${path}" fill="none" stroke="#2C1A00" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,
  );
}

console.log(`Media library generated in ${mediaDir}`);
console.log(`  audio: ${readdirSync(resolve(mediaDir, 'audio')).length} files`);
console.log(`  images: ${readdirSync(resolve(mediaDir, 'img')).length} files`);
