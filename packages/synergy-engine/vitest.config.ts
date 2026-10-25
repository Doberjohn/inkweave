import path from 'node:path';
import {defineConfig} from 'vitest/config';

// CodeScene roots file paths at the repository, so lcov's paths must start at packages/ (#964).
const REPO_ROOT = path.resolve(import.meta.dirname, '../..');

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Collected only on master pushes in CI, where it feeds CodeScene's coverage views (#964).
    // Lists every source file: CodeScene counts a file missing from the report as 0%.
    coverage: {
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/__tests__/**', 'src/**/index.ts'],
      reporter: ['text-summary', ['lcovonly', {projectRoot: REPO_ROOT}]],
    },
  },
});
