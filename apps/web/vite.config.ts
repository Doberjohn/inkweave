/// <reference types="vitest" />
import {sentryVitePlugin} from '@sentry/vite-plugin';
import {defineConfig, type Plugin} from 'vite';
import react from '@vitejs/plugin-react';
import {visualizer} from 'rollup-plugin-visualizer';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../..');
const SYNERGY_DIR = path.resolve(__dirname, 'public/data/synergies');
const MANIFEST = path.join(SYNERGY_DIR, '_manifest.json');
const ENGINE_SRC = path.join(ROOT, 'packages/synergy-engine/src');
const CARD_DATA = path.resolve(__dirname, 'public/data/allCards.json');

/**
 * Rebuilds the engine and regenerates pre-computed synergies on dev server start
 * when missing or stale. Compares engine source and card data mtime against
 * _manifest.json to detect staleness.
 */
function ensureSynergiesPlugin(): Plugin {
  return {
    name: 'ensure-synergies',
    apply: 'serve',
    configureServer() {
      const missing = !fs.existsSync(MANIFEST);
      let stale = false;

      if (!missing) {
        const manifestMtime = fs.statSync(MANIFEST).mtimeMs;
        stale =
          isNewerRecursive(ENGINE_SRC, manifestMtime) ||
          (fs.existsSync(CARD_DATA) && fs.statSync(CARD_DATA).mtimeMs > manifestMtime);
      }

      if (missing || stale) {
        const reason = missing ? 'missing' : 'stale (engine source or card data changed)';
        console.log(`\n⚙ Synergy data ${reason} — regenerating...`);
        try {
          // shell: true needed for pnpm (Windows .cmd shim); args are hardcoded constants
          const build = spawnSync('pnpm', ['build:engine'], {
            cwd: ROOT,
            stdio: 'inherit',
            shell: true,
          });
          if (build.error) throw build.error;
          if (build.status !== 0) throw new Error(`Engine build failed (exit ${build.status})`);
          const precompute = spawnSync('node', ['scripts/precompute-synergies.mjs'], {
            cwd: ROOT,
            stdio: 'inherit',
            shell: true,
          });
          if (precompute.error) throw precompute.error;
          if (precompute.status !== 0)
            throw new Error(`Precompute failed (exit ${precompute.status})`);
        } catch (err) {
          console.error('⚠ Failed to pre-compute synergies:', err);
          console.error('  Run manually: pnpm build:engine && pnpm precompute-synergies\n');
        }
      }
    },
  };
}

/** Check if any file under `dir` has mtime newer than `threshold`. */
function isNewerRecursive(dir: string, threshold: number): boolean {
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (isNewerRecursive(full, threshold)) return true;
    } else if (fs.statSync(full).mtimeMs > threshold) {
      return true;
    }
  }
  return false;
}

/**
 * Inline all CSS into <style> tags in the HTML output.
 * Eliminates the render-blocking CSS round-trip (~2 KB saved).
 */
function inlineCssPlugin(): Plugin {
  return {
    name: 'inline-css',
    enforce: 'post',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        if (!ctx.bundle) return html;

        for (const [fileName, chunk] of Object.entries(ctx.bundle)) {
          if (chunk.type === 'asset' && fileName.endsWith('.css')) {
            const cssContent = typeof chunk.source === 'string' ? chunk.source : '';
            // Replace the <link> tag with an inline <style> tag
            html = html.replace(
              new RegExp(
                `<link[^>]*href="[^"]*${fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>`,
              ),
              `<style>${cssContent}</style>`,
            );
            // Remove the CSS file from the bundle
            delete ctx.bundle[fileName];
          }
        }
        return html;
      },
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    ensureSynergiesPlugin(),
    react(),
    inlineCssPlugin(),
    process.env.SENTRY_AUTH_TOKEN &&
      sentryVitePlugin({
        org: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT,
        authToken: process.env.SENTRY_AUTH_TOKEN,
        sourcemaps: {
          filesToDeleteAfterUpload: ['dist/**/*.map'],
        },
      }),
    process.env.ANALYZE &&
      visualizer({
        filename: 'dist/stats.html',
        open: true,
        gzipSize: true,
        brotliSize: true,
      }),
  ],
  server: {
    host: true,
    proxy: {
      // Mirror Vercel rewrite: proxy card images to Ravensburger CDN in dev
      '/card-images': {
        target: 'https://api.lorcana.ravensburger.com/images',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/card-images/, ''),
      },
    },
  },
  build: {
    sourcemap: 'hidden',
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/shared/test-utils/setup.ts'],
    exclude: ['**/node_modules/**', '**/e2e/**'],
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
