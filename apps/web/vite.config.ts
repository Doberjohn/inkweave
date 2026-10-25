/// <reference types="vitest" />
import {sentryVitePlugin} from '@sentry/vite-plugin';
import {type IndexHtmlTransformContext, type Plugin} from 'vite';
import {defineConfig} from 'vitest/config';
import react, {reactCompilerPreset} from '@vitejs/plugin-react';
import babel from '@rolldown/plugin-babel';
import {VitePWA} from 'vite-plugin-pwa';
import {visualizer} from 'rollup-plugin-visualizer';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';

// import.meta.dirname, not __dirname: under Vite's native config loader (the planned
// default) this file runs as plain ESM, where __dirname does not exist.
const ROOT = path.resolve(import.meta.dirname, '../..');
const SYNERGY_DIR = path.resolve(import.meta.dirname, 'public/data/synergies');
const MANIFEST = path.join(SYNERGY_DIR, '_manifest.json');
const ENGINE_SRC = path.join(ROOT, 'packages/synergy-engine/src');
const CARD_DATA = path.resolve(import.meta.dirname, 'public/data/allCards.json');
/** A hashed card image, as download-card-images.mjs names them: /card-images/{id}.{hash}.avif. */
const HASHED_ART = /^\/card-images\/[^/]+\.[0-9a-f]{16}(-sm)?\.avif$/;
const PREVIEW_DATA = path.resolve(import.meta.dirname, 'public/data/previewCards.json');
// Precompute also writes the homepage's featured cards (#641) from featuredCardIds.json, their
// only source (#957).
const FEATURED_CARDS = path.resolve(import.meta.dirname, 'public/data/featuredCards.json');
const FEATURED_IDS = path.resolve(import.meta.dirname, 'src/features/cards/featuredCardIds.json');

/**
 * Rebuilds the engine and regenerates pre-computed synergies on dev server start
 * when missing or stale. Compares engine source, card and preview data and the
 * featured-card list's mtimes against _manifest.json.
 */
function ensureSynergiesPlugin(): Plugin {
  return {
    name: 'ensure-synergies',
    // Dev server only. `vite preview` also resolves with command 'serve', but it serves the
    // built dist/, so regenerating public/ there would be wasted work.
    apply: (_config, {command, isPreview}) => command === 'serve' && !isPreview,
    // configResolved, not configureServer: the dev server snapshots public/ between the two
    // hooks, and its watcher only reports files created after its initial scan. Files written
    // in configureServer missed both, so they were served as index.html until a restart.
    configResolved() {
      const reason = synergyDataRefreshReason();
      if (!reason) return;
      console.log(`\n⚙ Synergy data ${reason} — regenerating...`);
      try {
        regenerateSynergyData();
      } catch (err) {
        console.error('⚠ Failed to pre-compute synergies:', err);
        console.error('  Run manually: pnpm build:engine && pnpm precompute-synergies\n');
      }
    },
  };
}

/** Rebuilds the engine, then reruns precompute (synergies and the featured cards). Throws on failure. */
function regenerateSynergyData(): void {
  // A single command string: with shell: true, Node 24 deprecates passing args
  // (DEP0190), since the shell joins them unescaped. The shell is only there so
  // Windows can run pnpm's .cmd shim.
  checkStep('Engine build', spawnSync('pnpm build:engine', {cwd: ROOT, stdio: 'inherit', shell: true}));
  // process.execPath is the running Node binary, so this needs no shell or PATH lookup.
  checkStep(
    'Precompute',
    spawnSync(process.execPath, ['scripts/precompute-synergies.mjs'], {cwd: ROOT, stdio: 'inherit'}),
  );
}

/** Throws when a step couldn't start or exited non-zero. */
function checkStep(label: string, {error, status}: {error?: Error; status: number | null}): void {
  if (error) throw error;
  if (status !== 0) throw new Error(`${label} failed (exit ${status})`);
}

/** Why the synergy data needs regenerating: 'missing', 'stale (...)', or null when it's current. */
function synergyDataRefreshReason(): string | null {
  if (!fs.existsSync(MANIFEST) || !fs.existsSync(FEATURED_CARDS)) return 'missing';
  if (inputsNewerThanManifest()) return 'stale (engine source, card data or featured cards changed)';
  return null;
}

/** Whether the engine source or any data input changed after precompute last wrote the manifest. */
function inputsNewerThanManifest(): boolean {
  const manifestMtime = fs.statSync(MANIFEST).mtimeMs;
  const newerThanManifest = (file: string) =>
    fs.existsSync(file) && fs.statSync(file).mtimeMs > manifestMtime;
  return (
    isNewerRecursive(ENGINE_SRC, manifestMtime) ||
    [CARD_DATA, PREVIEW_DATA, FEATURED_IDS].some(newerThanManifest)
  );
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

type OutputBundle = NonNullable<IndexHtmlTransformContext['bundle']>;

/** A stylesheet's name in the chunks' preload lists, e.g. "assets/RevealsPage-<hash>.css". */
const STYLESHEET_NAME = /["'`](assets\/[^"'`]+?\.css)["'`]/g;

/**
 * Drops a stylesheet that index.html now inlines from the bundle and from every chunk's CSS
 * list. A lazy chunk that imports a startup chunk lists that chunk's CSS among the files Vite's
 * preload helper loads before running it, and Vite writes those lists into the chunks after this
 * plugin's HTML hook. Left on a list, the helper links the deleted file.
 */
function dropInlinedCss(bundle: OutputBundle, fileName: string): void {
  delete bundle[fileName];
  for (const output of Object.values(bundle)) {
    if (output.type === 'chunk') output.viteMetadata?.importedCss.delete(fileName);
  }
}

/** The stylesheets that chunks load at run time but the bundle doesn't have. */
function missingStylesheets(bundle: OutputBundle): string[] {
  const named = Object.values(bundle)
    .filter((output) => output.type === 'chunk')
    .flatMap((chunk) => [...chunk.code.matchAll(STYLESHEET_NAME)].map(([, name]) => name));
  return [...new Set(named)].filter((name) => !(name in bundle));
}

/**
 * Inline the render-blocking startup CSS into <style> tags in index.html and drop
 * those files from the bundle (eliminates the CSS round-trip, ~2 KB saved). Code-split
 * route CSS is deliberately left in the bundle so it still loads at runtime via its
 * JS chunk — inlining only applies to stylesheets actually linked in index.html.
 *
 * Since the startup chunk groups (#789), react-loading-skeleton's CSS sits in the library
 * group's stylesheet, which this plugin inlines, and every lazy route listed that file for the
 * preload helper. The prerender then saved the helper's link to it into every page, so each page
 * view waited on a request that 404s, and a page served without the prerender (staging) reloaded
 * once when the preload failed. E2E on a production build caught it (#874). dropInlinedCss takes
 * an inlined file off those lists, and the build fails if a chunk still names a stylesheet the
 * bundle doesn't have.
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
            const before = html;
            // Replace the entry <link> tag with an inline <style> tag
            html = html.replace(
              new RegExp(
                `<link[^>]*href="[^"]*${fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>`,
              ),
              `<style>${cssContent}</style>`,
            );
            // Only drop the emitted file if we actually inlined it (its <link> was
            // present in index.html). Code-split route CSS (e.g. PlaystyleGalleryPage,
            // RevealsPage) has no <link> here — it is fetched at runtime by its JS
            // chunk. Deleting it would 404 the stylesheet on production, so the
            // route's styles (fan-out animations) silently never apply.
            if (html !== before) {
              dropInlinedCss(ctx.bundle, fileName);
            }
          }
        }
        return html;
      },
    },
    // `post`, so it reads the chunks after Vite has written their preload lists.
    generateBundle: {
      order: 'post',
      handler(_options, bundle) {
        const missing = missingStylesheets(bundle);
        if (missing.length > 0) {
          this.error(`Chunks load stylesheets the build doesn't have: ${missing.join(', ')}`);
        }
      },
    },
  };
}

/** Chunk files no page can load, found by unloadableChunksPlugin as the bundle is written. */
const unloadableChunks = new Set<string>();

/**
 * Finds the chunks no page can load (#928). A lazy import behind a flag that is off never runs, but
 * Rolldown still emits its chunk, and the service worker precached it for every new visitor. A
 * chunk is loadable when index.html, or a loadable chunk, names its file: static imports, dynamic
 * imports and Vite's preload lists all spell out file names. It reads the bundle as written, so
 * the names are final, and VitePWA writes the service worker after it, in closeBundle.
 */
function unloadableChunksPlugin(): Plugin {
  return {
    name: 'unloadable-chunks',
    apply: 'build',
    writeBundle(_options, bundle) {
      const outputs = Object.values(bundle);
      const chunks = outputs.filter((output) => output.type === 'chunk');
      const sources = outputs
        .filter((output) => output.type === 'asset')
        .filter((asset) => asset.fileName.endsWith('.html'))
        .map((page) => String(page.source));
      const loadable = new Set<string>();
      for (let source = sources.pop(); source !== undefined; source = sources.pop()) {
        for (const chunk of chunks) {
          if (!loadable.has(chunk.fileName) && source.includes(path.basename(chunk.fileName))) {
            loadable.add(chunk.fileName);
            sources.push(chunk.code);
          }
        }
      }
      unloadableChunks.clear();
      for (const chunk of chunks) if (!loadable.has(chunk.fileName)) unloadableChunks.add(chunk.fileName);
    },
  };
}

/**
 * Local Windows runs cap Vitest at 4 workers (#720). The repo sits on a spinning disk there, and
 * on a cold file cache the default first wave (11 workers on the 12-thread dev box) needs over
 * 60 s to start, mostly loading jsdom, past Vitest's hardcoded worker-start limit, so none of its
 * files run. Four workers measured 35 to 43 s. CI keeps Vitest's default: it has never hit this.
 * VITEST_MAX_WORKERS overrides the cap.
 */
function resolveVitestWorkers(): number | undefined {
  const override = Number.parseInt(process.env.VITEST_MAX_WORKERS ?? '', 10);
  if (override > 0) return override;
  if (process.env.CI) return undefined;
  return process.platform === 'win32' ? 4 : undefined;
}

/**
 * Startup chunk groups (#789). The entry shares these modules with lazy chunks, and Rolldown's
 * automatic splitting gave most of them a small startup file each: startup loaded ten files, and
 * with these two groups it loads four. The libraries get a group of their own, which changes only
 * when a dependency does, so returning visitors keep it across deploys. It also takes react-dom's
 * client and Speed Insights, which only the entry imports, so a deploy that changes only app code
 * re-downloads none of the libraries. In the app group, every deploy that touched one of its
 * modules would re-download react-router too. List only modules the startup code already loads.
 * `tags: ['$initial']` drops a listed module from its group once nothing at startup imports it,
 * but a module that newly becomes shared splits out on its own until it is listed here.
 */
const STARTUP_VENDOR = [
  /node_modules[\\/]react[\\/]/,
  /node_modules[\\/]react-dom[\\/]/,
  /node_modules[\\/]scheduler[\\/]/,
  /node_modules[\\/]react-router[\\/]/,
  /node_modules[\\/]@vercel[\\/]analytics[\\/]/,
  /node_modules[\\/]@vercel[\\/]speed-insights[\\/]/,
  /node_modules[\\/]react-loading-skeleton[\\/]/,
];
const STARTUP_SHARED = [
  /src[\\/]shared[\\/]constants[\\/](theme|setLogos|promoSets|cardBar)\.ts$/,
  /src[\\/]shared[\\/]hooks[\\/](useHover|useBoop|usePrintingSelection|useResponsive)\.ts$/,
  /src[\\/]shared[\\/]utils[\\/](touchGuard|prefersReducedMotion)\.ts$/,
  /src[\\/]shared[\\/]components[\\/](CtaButton|ctaStyles|IconButton|Footer)\.tsx?$/,
  /src[\\/]shared[\\/]lib[\\/](analytics|posthog|sentry|whenLoadedAndIdle)\.ts$/,
  /src[\\/]features[\\/]cards[\\/](loader|previewCards|inkHubs)\.ts$/,
  /src[\\/]pages[\\/]homeFrame\.ts$/,
];
const matchesAny = (patterns: RegExp[]) => (id: string) => patterns.some((re) => re.test(id));

// Staging's icons (#905). deploy-staging.yml sets INKWEAVE_ICON_SET=staging for its build alone,
// so staging.inkweave.ink shows the Emerald and Ruby drop from public/brand/staging/, under the
// same file names, while production and every PR preview keep the gold one.
const ICON_DIR = process.env.INKWEAVE_ICON_SET === 'staging' ? 'brand/staging/' : '';

function iconSetPlugin(): Plugin {
  return {
    name: 'icon-set',
    transformIndexHtml(html) {
      if (!ICON_DIR) return html;
      return html.replace(/href="\/(favicon|apple-touch-icon)\.png"/g, `href="/${ICON_DIR}$1.png"`);
    },
  };
}

/**
 * The production builds of two libraries, for `vite build` only (#927). React Router's package
 * points every export condition at its development build, so production shipped its dev warnings;
 * the alias swaps in `dist/production`. Sentry keeps a debug logger unless `__SENTRY_DEBUG__` is
 * false, and the app never turns `debug` on. `pnpm dev` and Vitest keep both, for their warnings.
 */
function productionLibrariesPlugin(): Plugin {
  // react-router is react-router-dom's dependency, not the app's, so resolve it from there.
  const fromRouterDom = createRequire(createRequire(import.meta.url).resolve('react-router-dom/package.json'));
  const routerDir = path.dirname(fromRouterDom.resolve('react-router/package.json'));
  return {
    name: 'production-libraries',
    apply: 'build',
    config: () => ({
      define: {__SENTRY_DEBUG__: 'false'},
      resolve: {
        alias: [
          {find: /^react-router$/, replacement: path.join(routerDir, 'dist/production/index.mjs')},
          {find: /^react-router\/dom$/, replacement: path.join(routerDir, 'dist/production/dom-export.mjs')},
        ],
      },
    }),
  };
}

/** The card data the app fetches whole. public/ keeps them indented, for readable diffs. */
const MINIFIED_DATA = ['allCards.json', 'previewCards.json'];

/**
 * Writes the build's copies of the card data without whitespace (#927): allCards.json, which every
 * visit downloads, is 10.4 kB smaller gzipped. The deploy injects the image hashes into public/
 * before it builds (download-card-images.mjs), so the copy this minifies has them.
 */
function minifyCardDataPlugin(): Plugin {
  let outDir = '';
  return {
    name: 'minify-card-data',
    apply: 'build',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      for (const name of MINIFIED_DATA) {
        const file = path.join(outDir, 'data', name);
        if (fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify(JSON.parse(fs.readFileSync(file, 'utf8'))));
      }
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  define: {
    // Sentry's `environment` (#740). Vercel sets VERCEL_ENV in every build it runs, previews
    // included, and deploy.yml sets it for production's CI build. A build without it says
    // 'unknown' rather than pass as production. Vitest (which sets VITEST before loading this
    // config) always gets 'unknown', so the shell's VERCEL_ENV can't leak into the tests.
    __DEPLOY_ENV__: JSON.stringify(
      process.env.VITEST ? 'unknown' : (process.env.VERCEL_ENV ?? 'unknown'),
    ),
  },
  plugins: [
    ensureSynergiesPlugin(),
    react(),
    // React Compiler runs via Babel: plugin-react v6 dropped its built-in Babel
    // (Vite 8/Oxc handles React Refresh now), so the compiler is wired through a
    // separate @rolldown/plugin-babel. reactCompilerPreset() defaults to React 19
    // (our version) and self-filters to jsx/tsx; `target` is only for downgrading
    // to React 17/18. Must run after react() so JSX is lowered first.
    babel({presets: [reactCompilerPreset()]}),
    iconSetPlugin(),
    productionLibrariesPlugin(),
    minifyCardDataPlugin(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: [`${ICON_DIR}favicon.png`, `${ICON_DIR}apple-touch-icon.png`],
      manifest: {
        name: 'Inkweave — Master Lorcana Synergies',
        short_name: 'Inkweave',
        description:
          'Discover powerful card synergies for Disney Lorcana. Build stronger decks in Core format.',
        theme_color: '#0d0d14',
        background_color: '#0d0d14',
        display: 'standalone',
        start_url: '/',
        icons: [
          {src: `/${ICON_DIR}pwa-192x192.png`, sizes: '192x192', type: 'image/png'},
          {src: `/${ICON_DIR}pwa-512x512.png`, sizes: '512x512', type: 'image/png'},
          {src: `/${ICON_DIR}pwa-512x512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable'},
        ],
      },
      workbox: {
        // Don't emit sw.js.map. VitePWA's GenerateSW sourcemap option defaults
        // to the Vite build.sourcemap value ('hidden'), so the workbox step
        // produces a service-worker map *after* the Sentry plugin's
        // filesToDeleteAfterUpload pass — meaning it slips past deletion and
        // ships with full sourcesContent (issue #358). We don't upload the SW
        // map to Sentry anyway, so generating it has no upside.
        sourcemap: false,
        globPatterns: [
          '**/*.{js,css,html,woff2}',
          // The small symbols the app draws all over (#934): the inks, then the inkwell and the
          // common and uncommon rarity. They are files rather than inlined into the JavaScript, so
          // they are named here to keep each of them on screen offline. The bigger rarity art and
          // the printing symbols load as pages show them, as before.
          'assets/{amber,amethyst,emerald,ruby,sapphire,steel}-*.svg',
          'assets/{inkable,uninkable,common,uncommon}-*.svg',
        ],
        // Leave out the chunks no page loads (#928), which every new visitor downloaded. It drops
        // only JavaScript chunk files, so the symbols above stay in.
        manifestTransforms: [
          (entries) => ({
            manifest: entries.filter((entry) => !unloadableChunks.has(entry.url)),
            warnings: [...unloadableChunks].map((file) => `Not precached, no page loads it: ${file}`),
          }),
        ],
        // Don't fall back to index.html for static-asset paths — they're real
        // files, not SPA routes. Without this, pasting a direct asset URL into
        // a new tab returns the SPA shell, which boots React Router, fails to
        // match the path, and renders NotFoundPage.tsx (HTTP 200 + a "404"
        // looking page). The runtime caching rules below handle these paths.
        navigateFallbackDenylist: [
          /^\/card-images\//,
          /^\/card-images-preview\//,
          /^\/data\//,
          /^\/assets\//,
        ],
        runtimeCaching: [
          {
            urlPattern: /\/data\/allCards\.json$/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'card-data',
              expiration: {maxEntries: 1, maxAgeSeconds: 60 * 60 * 24},
            },
          },
          {
            // Synergy JSON is mutable but its URL is NOT content-addressed (a card's file keeps
            // the same /data/synergies/<id>.json path when a rule change alters its contents), so
            // CacheFirst would pin a returning visitor to pre-deploy synergies until the entry
            // expires (was invisible for 24h after a new rule shipped). StaleWhileRevalidate serves
            // the cached copy instantly and refetches in the background, matching allCards.json.
            urlPattern: /\/data\/synergies\/.+\.json$/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'synergy-data',
              expiration: {maxEntries: 500, maxAgeSeconds: 60 * 60 * 24},
            },
          },
          {
            urlPattern: /\/card-images\/.+\.avif$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'card-images',
              expiration: {maxEntries: 600, maxAgeSeconds: 60 * 60 * 24 * 30},
            },
          },
        ],
      },
    }),
    inlineCssPlugin(),
    unloadableChunksPlugin(),
    !!process.env.SENTRY_AUTH_TOKEN &&
      sentryVitePlugin({
        org: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT,
        authToken: process.env.SENTRY_AUTH_TOKEN,
        sourcemaps: {
          filesToDeleteAfterUpload: ['dist/**/*.map'],
        },
      }),
    !!process.env.ANALYZE &&
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
      // Mirror Vercel rewrite: proxy card images to Ravensburger CDN in dev.
      // Trailing slash is load-bearing — without it, Vite's prefix matcher also
      // grabs /card-images-preview/* (local AVIFs for Set 12 previews).
      '/card-images/': {
        target: 'https://api.lorcana.ravensburger.com/images',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/card-images/, ''),
        // A hashed file ({id}.{hash}.avif) is ours, never Ravensburger's: `pnpm download-images`
        // writes them into public/, and a card with hashes and no links draws from them (#932).
        bypass: (req) => (HASHED_ART.test(req.url ?? '') ? req.url : undefined),
      },
    },
  },
  build: {
    sourcemap: 'hidden',
    rolldownOptions: {
      // Inline imported constants wherever they are used, not only in conditions (the default
      // 'smart' mode, one pass). Measured with #927: User-facing JS 620 B smaller.
      optimization: {inlineConst: {mode: 'all', pass: 3}},
      output: {
        codeSplitting: {
          // A group also takes the modules its own modules import. The vendor group's higher
          // priority keeps the libraries that app modules import in the vendor group.
          groups: [
            {
              name: 'startup-vendor',
              priority: 2,
              tags: ['$initial'],
              test: matchesAny(STARTUP_VENDOR),
            },
            {
              name: 'startup-shared',
              priority: 1,
              tags: ['$initial'],
              test: matchesAny(STARTUP_SHARED),
            },
          ],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    maxWorkers: resolveVitestWorkers(),
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
      ],
    },
  },
});
