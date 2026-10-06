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
      globals: globals.node,
    },
  },
  {
    // Its page.addInitScript and page.waitForFunction callbacks run in the crawled page, not Node.
    files: ['scripts/prerender.mjs'],
    languageOptions: {globals: {window: 'readonly', document: 'readonly'}},
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['middleware.ts'],
  },
);
