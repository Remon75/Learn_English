import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    // Each file gets its own process so the SQLite module state is isolated.
    pool: 'forks',
    fileParallelism: false,
    testTimeout: 20_000,
  },
});
