/// <reference types="vitest" />
import {sentryVitePlugin} from '@sentry/vite-plugin';
import {defineConfig, type Plugin} from 'vite';
import react from '@vitejs/plugin-react';
import {visualizer} from 'rollup-plugin-visualizer';

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
    react(),
    inlineCssPlugin(),
    process.env.SENTRY_AUTH_TOKEN &&
      sentryVitePlugin({
        org: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT,
        authToken: process.env.SENTRY_AUTH_TOKEN,
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
    sourcemap: true,
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
