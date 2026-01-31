/// <reference types="vitest" />
import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/shared/test-utils/setup.ts'],
    coverage: {
      reporter: ['text', 'json-summary', 'html'],
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/*.test.{ts,tsx}',
        '**/test-utils/**',
        '**/index.ts', // Barrel files (re-exports only)
        'src/features/cards/utils/cardHelpers.ts', // Re-exports from synergy-engine
        'src/features/cards/utils/typeGuards.ts', // Re-exports from synergy-engine
      ],
    },
  },
});
