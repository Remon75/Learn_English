import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { MEDIA_ROOT } from '../config.js';

/**
 * Media delivery.
 *
 * Curriculum data references media by a *logical* path with no file
 * extension, for example `/media/audio/hello`. This module resolves that
 * path to whatever format actually exists on disk, using content
 * negotiation for audio and a fixed preference order for images.
 *
 * The benefit is that the asset format can change without touching a
 * single line of curriculum content: ship WebP instead of PNG, or Opus
 * instead of WAV, and the app keeps working.
 *
 * The API rewrites media references to concrete, extension-bearing URLs
 * before sending them to the client. That matters for audio: a browser's
 * audio decoder determines the codec from the response, and a URL without
 * an extension leaves some decoders guessing.
 */

const AUDIO_EXTENSIONS = ['.mp3', '.ogg', '.opus', '.wav', '.m4a'] as const;
const IMAGE_EXTENSIONS = ['.svg', '.webp', '.png', '.jpg', '.jpeg'] as const;

const CONTENT_TYPES: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.opus': 'audio/opus',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};

/** Parses `Accept` into a list of media types, most preferred first. */
function acceptedTypes(header: string | undefined): string[] {
  if (!header) return [];
  return header
    .split(',')
    .map((part) => {
      const [type, ...params] = part.trim().split(';');
      const quality = params
        .map((p) => p.trim())
        .find((p) => p.startsWith('q='))
        ?.slice(2);
      return { type: (type ?? '').trim(), quality: quality ? Number(quality) : 1 };
    })
    .filter((entry) => entry.type.length > 0 && entry.quality > 0)
    .sort((a, b) => b.quality - a.quality)
    .map((entry) => entry.type);
}

function candidatesFor(logicalPath: string): readonly string[] {
  return logicalPath.startsWith('/media/audio/') ? AUDIO_EXTENSIONS : IMAGE_EXTENSIONS;
}

function absolutePathFor(logicalPath: string, extension: string): string {
  return join(MEDIA_ROOT, `${logicalPath.slice('/media/'.length)}${extension}`);
}

/**
 * Resolves a logical media path to an absolute file path.
 * Returns null when no candidate format exists on disk.
 */
export function resolveMediaFile(
  logicalPath: string,
  accept?: string,
): { file: string; extension: string } | null {
  // A path that already carries an extension is served verbatim when it
  // exists, which keeps direct links working.
  const existingExt = extname(logicalPath);
  if (existingExt && CONTENT_TYPES[existingExt.toLowerCase()]) {
    const direct = join(MEDIA_ROOT, logicalPath.slice('/media/'.length));
    if (existsSync(direct)) return { file: direct, extension: existingExt.toLowerCase() };
  }

  const candidates = candidatesFor(logicalPath);
  const accepted = acceptedTypes(accept);

  // Prefer a format the client explicitly asked for.
  for (const type of accepted) {
    const match = candidates.find((ext) => {
      const contentType = CONTENT_TYPES[ext]!;
      if (type === contentType) return true;
      if (contentType.startsWith(`${type}/`)) return true;
      if (type === 'image/*' && contentType.startsWith('image/')) return true;
      if (type === 'audio/*' && contentType.startsWith('audio/')) return true;
      return false;
    });
    if (match) {
      const file = absolutePathFor(logicalPath, match);
      if (existsSync(file)) return { file, extension: match };
    }
  }

  // Otherwise take the first candidate that exists.
  for (const ext of candidates) {
    const file = absolutePathFor(logicalPath, ext);
    if (existsSync(file)) return { file, extension: ext };
  }

  return null;
}

/**
 * Returns the public URL for a logical media path, including the real
 * extension. Unresolvable paths are returned unchanged so the client can
 * report a missing asset rather than crashing.
 */
export function mediaUrl(logicalPath: string): string {
  const found = resolveMediaFile(logicalPath);
  if (!found) return logicalPath;
  return `${logicalPath.slice(0, logicalPath.length - extname(logicalPath).length)}${found.extension}`;
}

export async function mediaRoutes(app: FastifyInstance): Promise<void> {
  app.get('/media/*', async (request: FastifyRequest, reply) => {
    const logicalPath = (request.url.split('?')[0] ?? '').split('#')[0] ?? '';

    // Path traversal guard: the resolved file must stay inside MEDIA_ROOT.
    const relative = normalize(logicalPath.slice('/media/'.length)).replace(/^([/\\])+/, '');
    if (relative.startsWith('..') || relative.includes(`..${sep}`)) {
      return reply.code(400).send({ error: 'invalid_path', message: 'Invalid media path.' });
    }

    const found = resolveMediaFile(logicalPath, request.headers.accept);
    if (!found) {
      return reply.code(404).send({ error: 'media_not_found', message: 'No such media asset.' });
    }

    const contentType = CONTENT_TYPES[found.extension] ?? 'application/octet-stream';
    const stats = statSync(found.file);

    return reply
      .header('content-type', contentType)
      .header('content-length', stats.size)
      // Media is immutable: a logical id always maps to the same content.
      .header('cache-control', 'public, max-age=31536000, immutable')
      .header('x-content-type-options', 'nosniff')
      .send(createReadStream(found.file));
  });
}

export { resolve as resolvePath };
