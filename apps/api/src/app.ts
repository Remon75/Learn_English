import Fastify, { LogController, type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { ZodError } from 'zod';
import { registerAuth } from './lib/auth.js';
import { getDb } from './db/index.js';
import { curriculumRoutes, profileRoutes } from './routes/profiles.js';
import { parentRoutes } from './routes/parent.js';
import { sessionRoutes } from './routes/sessions.js';
import { mediaRoutes } from './routes/media.js';

export interface BuildOptions {
  logger?: boolean;
  /** Enables the Swagger UI route. Disabled in tests for speed. */
  docs?: boolean;
}

export async function buildApp(options: BuildOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: options.logger ?? true,
    // The API never receives large payloads: audio stays local.
    bodyLimit: 256 * 1024,
    // Fastify 5 deprecated the top-level `disableRequestLogging` option in
    // favour of a LogController instance. Request logging follows the
    // logger: off when the logger is off, on otherwise.
    logController: new LogController({
      disableRequestLogging: options.logger === false,
    }),
  });

  await app.register(cors, {
    origin: true,
    credentials: true,
  });

  await app.register(rateLimit, {
    // A generous local limit. This protects a shared family device from a
    // runaway client without ever blocking a child mid-session.
    max: 600,
    timeWindow: '1 minute',
  });

  await app.register(swagger, {
    openapi: {
      openapi: '3.1.0',
      info: {
        title: 'Sparkle English API',
        version: '0.1.0',
        description:
          'Local-first API for a privacy-first English learning app for children. ' +
          'All data stays on the operator\'s own hardware. No third-party services are contacted.',
        license: { name: 'MIT' },
      },
      servers: [{ url: '/', description: 'This instance' }],
      tags: [
        { name: 'profiles', description: 'Local child profiles' },
        { name: 'curriculum', description: 'Versioned curriculum data' },
        { name: 'sessions', description: 'Learning sessions and scoring' },
        { name: 'parent', description: 'Caregiver-gated settings and reports' },
      ],
      components: {
        securitySchemes: {
          deviceToken: {
            type: 'apiKey',
            name: 'X-Device-Token',
            in: 'header',
            description: 'Per-device secret issued when the profile is created.',
          },
        },
      },
    },
  });

  if (options.docs !== false) {
    await app.register(swaggerUi, {
      routePrefix: '/docs',
      uiConfig: { docExpansion: 'list', deepLinking: true },
    });
  }

  await registerAuth(app);
  getDb();

  app.get('/health', async () => ({
    status: 'ok',
    service: 'sparkle-english-api',
    offline: true,
  }));

  await app.register(profileRoutes);
  await app.register(curriculumRoutes);
  await app.register(sessionRoutes);
  await app.register(parentRoutes);
  await app.register(mediaRoutes);

  app.setNotFoundHandler((request, reply) => {
    reply.code(404).send({
      error: 'not_found',
      message: `No route for ${request.method} ${request.url}`,
    });
  });

  app.setErrorHandler((error: unknown, request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({
        error: 'validation_error',
        message: 'The request body failed validation.',
        details: error.issues,
      });
    }

    request.log.error({ err: error }, 'request failed');
    const statusCode =
      typeof error === 'object' && error !== null && 'statusCode' in error
        ? Number((error as { statusCode?: number }).statusCode ?? 500)
        : 500;
    const message =
      typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message?: unknown }).message)
        : 'Unexpected error';

    return reply.code(statusCode).send({
      error: statusCode >= 500 ? 'internal_error' : 'request_error',
      message: statusCode >= 500 ? 'Something went wrong on the server.' : message,
    });
  });

  return app;
}
