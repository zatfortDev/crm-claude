import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    setupFiles: ['tests/setup/env.js'],
    globalSetup: ['tests/setup/globalSetup.js'],
    // Los tests de integración comparten la base crm_test: se ejecutan en serie.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 60_000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.js'],
      exclude: ['src/generated/**', 'src/server.js'],
      reporter: ['text', 'html', 'lcov'],
    },
  },
});
