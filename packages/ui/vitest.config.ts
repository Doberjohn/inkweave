import path from 'node:path';
import babel from '@rolldown/plugin-babel';
import react, {reactCompilerPreset} from '@vitejs/plugin-react';
import {defineConfig} from 'vitest/config';

const ROOT = path.resolve(import.meta.dirname, '../..');

/** The app's Windows worker cap (#720), as resolveVitestWorkers in apps/web/vite.config.ts sets it. */
function resolveVitestWorkers(): number | undefined {
  const override = Number.parseInt(process.env.VITEST_MAX_WORKERS ?? '', 10);
  if (override > 0) return override;
  if (process.env.CI) return undefined;
  return process.platform === 'win32' ? 4 : undefined;
}

export default defineConfig({
  // The React Compiler pass the app's build applies to this source, so the tests run what ships.
  plugins: [react(), babel({presets: [reactCompilerPreset()]})],
  test: {
    environment: 'jsdom',
    globals: true,
    maxWorkers: resolveVitestWorkers(),
    setupFiles: ['./src/test-utils/setup.ts'],
    // CodeScene's coverage views (#964), as the app collects them: CI uploads this lcov with the
    // engine's and the app's, and the exclusions match theirs.
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
        '**/*.test.{ts,tsx}',
        '**/*.stories.tsx',
        '**/*.d.ts',
        '**/__tests__/**',
        '**/test-utils/**',
      ],
    },
  },
});
