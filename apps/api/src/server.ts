import { buildApp } from './app.js';
import { HOST, PORT } from './config.js';

const port = PORT;
const host = HOST;

const app = await buildApp({ logger: true });

try {
  await app.listen({ port, host });
  app.log.info(`Sparkle English API listening on http://${host}:${port}`);
  app.log.info(`OpenAPI docs at http://${host}:${port}/docs`);
} catch (error) {
  app.log.error(error);
  process.exit(1);
}

const shutdown = async (signal: string) => {
  app.log.info(`${signal} received, closing gracefully`);
  await app.close();
  process.exit(0);
};

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
