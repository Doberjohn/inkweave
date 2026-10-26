import {defineConfig, mergeConfig} from 'vitest/config';
import base from './vitest.config.ts';

// The engine suite with every tuned value edited (src/__tests__/perturbTuning.ts).
export default mergeConfig(
  base,
  defineConfig({test: {setupFiles: ['./src/__tests__/perturbTuning.ts']}}),
);
