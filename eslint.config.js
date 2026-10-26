import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// The root code outside the workspace packages: scripts/, .claude/hooks/, the root configs and
// middleware.ts. `pnpm -r lint` never reaches the root, and each package's config lints only its
// own folder, so this went unlinted from the 2026-01-31 monorepo move until #734.
export default tseslint.config(
  {
    extends: [js.configs.recommended],
    files: ['**/*.mjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      // Not globals.node: its CommonJS wrapper names (require, module, __dirname) are undefined in ESM.
      globals: globals.nodeBuiltin,
    },
  },
  {
    // Their page.addInitScript, page.evaluate and page.waitForFunction callbacks run in the
    // browser's page, not Node.
    files: ['scripts/prerender.mjs', 'scripts/check-prerender-handoff.mjs', 'scripts/check-sw-update.mjs'],
    languageOptions: {
      globals: {
        window: 'readonly',
        document: 'readonly',
        getComputedStyle: 'readonly',
        requestAnimationFrame: 'readonly',
        MutationObserver: 'readonly',
      },
    },
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['middleware.ts'],
  },
);
