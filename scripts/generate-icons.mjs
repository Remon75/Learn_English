#!/usr/bin/env node
/**
 * Generates the application icons.
 *
 * The icons are produced from code with a minimal PNG encoder so the
 * repository carries no binary art and every icon is reproducible. A
 * spark shape is drawn on an amber field.
 *
 * Usage: node scripts/generate-icons.mjs
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(here, '../apps/web/public');
const iconsDir = resolve(publicDir, 'icons');
mkdirSync(iconsDir, { recursive: true });

/* ------------------------------ PNG writer ------------------------------ */

function crc32(buffer) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  let crc = -1;
  for (let i = 0; i < buffer.length; i += 1) {
    crc = (crc >>> 8) ^ table[(crc ^ buffer[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData), 0);
  return Buffer.concat([length, typeAndData, crc]);
}

/** Encodes raw RGBA pixels as a PNG. */
function encodePng(width, height, rgba) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // adaptive filtering
  ihdr[12] = 0; // no interlace

  // Each scanline is prefixed with a filter byte (0 = none).
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ------------------------------ Drawing ------------------------------ */

const AMBER = [255, 179, 0];
const CREAM = [255, 248, 225];
const INK = [44, 26, 0];

/**
 * Builds the vertex list of a four-point sparkle.
 *
 * A sparkle is a star polygon: four outer points on the axes with four
 * inner points between them. Filling the polygon gives the straight,
 * concave edges the shape needs - a polar falloff would produce petals.
 */
function sparklePolygon(cx, cy, outer, inner, rotation = -Math.PI / 2) {
  const points = 4;
  const vertices = [];
  for (let i = 0; i < points * 2; i += 1) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = rotation + (Math.PI * i) / points;
    vertices.push([cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius]);
  }
  return vertices;
}

/** Even-odd point-in-polygon test. */
function pointInPolygon(x, y, vertices) {
  let inside = false;
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i, i += 1) {
    const [xi, yi] = vertices[i];
    const [xj, yj] = vertices[j];
    const straddles = yi > y !== yj > y;
    if (straddles && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function renderIcon(size, { maskable = false } = {}) {
  const rgba = Buffer.alloc(size * size * 4);
  const inset = maskable ? size * 0.18 : size * 0.08;
  const radius = maskable ? size * 0.5 : size * 0.22;
  const cx = size / 2;
  const cy = size / 2;

  const sparkleRadius = maskable ? size * 0.22 : size * 0.29;
  const main = sparklePolygon(cx, cy, sparkleRadius, sparkleRadius * 0.22);
  const companion = sparklePolygon(
    cx + sparkleRadius * 0.82,
    cy - sparkleRadius * 0.74,
    sparkleRadius * 0.36,
    sparkleRadius * 0.1,
    -Math.PI / 4,
  );

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const offset = (y * size + x) * 4;

      // Rounded-square background.
      const inBox = x >= inset && x <= size - inset && y >= inset && y <= size - inset;
      let colour = null;
      if (inBox) {
        const cornerX = Math.min(Math.max(x, inset + radius), size - inset - radius);
        const cornerY = Math.min(Math.max(y, inset + radius), size - inset - radius);
        if (Math.hypot(x - cornerX, y - cornerY) <= radius) colour = AMBER;
      }

      if (pointInPolygon(x, y, main)) colour = CREAM;
      if (pointInPolygon(x, y, companion)) colour = CREAM;

      // A dark ink dot in the middle for contrast.
      if (Math.hypot(x - cx, y - cy) <= size * 0.035) colour = INK;

      if (colour) {
        rgba[offset] = colour[0];
        rgba[offset + 1] = colour[1];
        rgba[offset + 2] = colour[2];
        rgba[offset + 3] = 255;
      } else {
        rgba[offset + 3] = 0;
      }
    }
  }

  return encodePng(size, size, rgba);
}

writeFileSync(resolve(iconsDir, 'icon-192.png'), renderIcon(192));
writeFileSync(resolve(iconsDir, 'icon-512.png'), renderIcon(512));
writeFileSync(resolve(iconsDir, 'icon-512-maskable.png'), renderIcon(512, { maskable: true }));

// A vector favicon for browsers that prefer it.
const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#FFB300"/>
  <path d="M32 8 L37 27 L56 32 L37 37 L32 56 L27 37 L8 32 L27 27 Z" fill="#FFF8E1"/>
  <circle cx="32" cy="32" r="2.6" fill="#2C1A00"/>
</svg>
`;
writeFileSync(resolve(publicDir, 'favicon.svg'), favicon, 'utf8');

console.log(`Icons written to ${iconsDir}`);
console.log('  icon-192.png, icon-512.png, icon-512-maskable.png, favicon.svg');
