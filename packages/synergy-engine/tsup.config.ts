import {defineConfig} from 'tsup';

export default defineConfig({
  // `card` is a separate entry (#640): the root bundles into one module, and a bundler can't split
  // one module across chunks, so any root import brings the whole rule set with it. ESM splitting
  // moves the code both entries share into a chunk.
  entry: ['src/index.ts', 'src/card.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  minify: false,
  treeshake: true,
});
