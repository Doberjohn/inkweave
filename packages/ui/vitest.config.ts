import path from 'node:path';
import babel from '@rolldown/plugin-babel';
import react, {reactCompilerPreset} from '@vitejs/plugin-react';
import {defineConfig} from 'vitest/config';
import {resolveVitestWorkers} from '../../apps/web/vitest-workers.ts';

const ROOT = path.resolve(import.meta.dirname, '../..');

export default defineConfig({
  // The React Compiler pass the app's build applies to this source, so the tests run what ships.
  plugins: [react(), babel({presets: [reactCompilerPreset()]})],
  test: {
    environment: 'jsdom',
    globals: true,
    maxWorkers: resolveVitestWorkers(),
    setupFiles: ['./src/test-utils/setup.ts'],
    // CodeScene's coverage views (#964), as the app collects them: CI uploads this lcov with the
    // engine's and the app's, and the exclusions are the app's (bar its generated Supabase types),
    // each also in project 79825's coverage exclusions.
    coverage: {
      include: ['src/**/*.{ts,tsx}'],
      reporter: [
        ...(process.env.CI
          ? (['text-summary'] as const)
          : (['text', 'json-summary', 'html'] as const)),
        ['lcovonly', {projectRoot: ROOT}],
      ],
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/*.test.{ts,tsx}',
        '**/*.stories.tsx',
        '**/*Story*.ts', // Data only stories load
        '**/*.d.ts',
        '**/__tests__/**',
        '**/test-utils/**',
        '**/index.ts', // Barrel files (re-exports only)
      ],
    },
  },
});
