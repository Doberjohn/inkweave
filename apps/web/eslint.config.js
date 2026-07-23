// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import storybook from 'eslint-plugin-storybook';

import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import reactCompiler from 'eslint-plugin-react-compiler';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import tseslint from 'typescript-eslint';
import {inkweave} from './eslint-rules/index.js';

export default tseslint.config(
  {ignores: ['dist', 'storybook-static', 'coverage']},
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      'react-compiler': reactCompiler,
      'jsx-a11y': jsxA11y,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.flatConfigs.recommended.rules,
      'react-refresh/only-export-components': ['warn', {allowConstantExport: true}],
      'react-compiler/react-compiler': 'error',
      // Ban manual memoization. The React Compiler (wired in vite.config.ts via
      // reactCompilerPreset) auto-memoizes component/hook values keyed on their
      // reactive deps, so useMemo/useCallback are redundant. This guard stops the
      // codebase from regressing after the #291 sweep (zero call sites remain).
      // NOTE: do NOT reach for eslint-disable to silence the exhaustive-deps
      // warnings this creates — disabling a react-hooks rule makes the compiler
      // skip optimizing the whole component. Fix at the source or leave the warning.
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.name='useMemo']",
          message:
            'Avoid useMemo — the React Compiler (vite.config.ts) auto-memoizes. Drop the wrapper and return the value directly (#291).',
        },
        {
          selector: "CallExpression[callee.name='useCallback']",
          message:
            'Avoid useCallback — the React Compiler (vite.config.ts) auto-memoizes. Drop the wrapper and use a plain function (#291).',
        },
      ],
    },
  },
  // Design-token discipline (#508, Design System Enforcement Wave 1) — scoped
  // to product code under src/. e2e specs (assertion pins), vite.config (PWA
  // theme-color), and .storybook (canvas config) are intentionally outside;
  // the value-grep gate (`check:design`) covers src + index.html separately.
  // Existing violations are grandfathered per-file in
  // eslint-rules/known-offenders.js (a ledger that only shrinks).
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: {inkweave},
    rules: {
      'inkweave/no-raw-hex-colors': 'error',
      'inkweave/no-raw-rgba': 'error',
      'inkweave/no-literal-font-family': 'error',
      'inkweave/no-raw-font-size': 'error',
      'inkweave/no-raw-radius': 'error',
      'inkweave/no-raw-z-index': 'error',
      'inkweave/no-raw-easing': 'error',
      'inkweave/no-backdrop-filter': 'error',
      'inkweave/no-adhoc-buttons': 'error',
      'inkweave/no-unshelled-dialogs': 'error',
      // OFF until the Wave-0 convergence sweep shrinks the ~429-literal noise
      // floor (#508 Step 6; enable together with seeding its ledger).
      'inkweave/no-raw-spacing': 'off',
    },
  },
  // No-new-styling-infrastructure + use-the-barrel guards (#508).
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {name: 'tailwindcss', message: 'Inkweave styles with inline CSS + design tokens; no Tailwind (CLAUDE.md Tech Stack).'},
            {name: 'styled-components', message: 'Inkweave styles with inline CSS + design tokens; no CSS-in-JS libraries.'},
            {name: '@emotion/react', message: 'Inkweave styles with inline CSS + design tokens; no CSS-in-JS libraries.'},
            {name: '@emotion/styled', message: 'Inkweave styles with inline CSS + design tokens; no CSS-in-JS libraries.'},
          ],
          patterns: [
            {
              group: ['**/shared/constants/theme', '**/shared/constants/playstyleUi'],
              message: 'Import tokens through the barrel (shared/constants), not the theme files directly.',
            },
          ],
        },
      ],
    },
  },
  storybook.configs['flat/recommended'],
);
