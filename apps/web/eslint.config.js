// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import storybook from 'eslint-plugin-storybook';

import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import tseslint from 'typescript-eslint';
import {inkweave} from './eslint-rules/index.js';

// No new styling infrastructure (#508). Exported for inkweave-ui's config, which lints with this
// one and restates these beside its own import boundary.
export const STYLING_BANS = [
  {name: 'tailwindcss', message: 'Inkweave styles with inline CSS + design tokens; no Tailwind (CLAUDE.md Tech Stack).'},
  {name: 'styled-components', message: 'Inkweave styles with inline CSS + design tokens; no CSS-in-JS libraries.'},
  {name: '@emotion/react', message: 'Inkweave styles with inline CSS + design tokens; no CSS-in-JS libraries.'},
  {name: '@emotion/styled', message: 'Inkweave styles with inline CSS + design tokens; no CSS-in-JS libraries.'},
];

// inkweave-ui's only door is its exports map: no path into packages/ui, and neither its root (it
// has none) nor its src/ around the map.
const UI_PACKAGE_DOOR = [
  {
    regex: '(^|/)packages/ui(/|$)',
    message: "Import inkweave-ui through its exports, such as 'inkweave-ui/components/CtaButton', never by path.",
  },
  {
    regex: '^inkweave-ui(/src(/.*)?)?$',
    message: "inkweave-ui has no root export and no src/ door: import a subpath such as 'inkweave-ui/components/CtaButton'.",
  },
];

// Ban manual memoization. The React Compiler (wired in vite.config.ts via reactCompilerPreset)
// auto-memoizes component/hook values keyed on their reactive deps, so useMemo/useCallback are
// redundant. This guard stops the codebase from regressing after the #291 sweep (zero call sites
// remain). Exported for inkweave-ui's config, which restates its no-restricted-syntax options.
export const MEMO_BANS = [
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
];

/**
 * no-restricted-imports reads import and export declarations, never import(), so each
 * `{regex, message}` pattern also stands as two no-restricted-syntax selectors: a string
 * specifier, in code or in a type (`typeof import('x')`), and a template's first part
 * (`../packages/ui/${name}`). Both ignore case, as no-restricted-imports does by default.
 */
export function dynamicImportBans(patterns) {
  return patterns.flatMap(({regex, message}) => {
    const value = `/${regex.replaceAll('/', '\\/')}/iu`;
    return [
      {selector: `:matches(ImportExpression, TSImportType) > Literal.source[value=${value}]`, message},
      {selector: `ImportExpression > TemplateLiteral.source > TemplateElement:first-child[value.cooked=${value}]`, message},
    ];
  });
}

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
      'jsx-a11y': jsxA11y,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.flatConfigs.recommended.rules,
      'react-refresh/only-export-components': ['warn', {allowConstantExport: true}],
      // React Compiler's checks come from eslint-plugin-react-hooks, which replaced
      // eslint-plugin-react-compiler (#937). Its recommended set leaves off two that the old
      // plugin reported: a hook used as a value or swapped between renders (hooks), and code
      // the compiler reads as invalid JavaScript (syntax). Two more things only the old plugin
      // caught, a turned-off react-hooks rule and a 'use no memo' directive, are
      // inkweave/no-compiler-opt-out below.
      'react-hooks/hooks': 'error',
      'react-hooks/syntax': 'error',
      // MEMO_BANS above. NOTE: do NOT reach for eslint-disable to silence the exhaustive-deps
      // warnings this creates — disabling a react-hooks rule makes the compiler
      // skip optimizing the whole component. Fix at the source or leave the warning.
      // inkweave-ui's door holds for import() too, in every .ts and .tsx file here, configs
      // included (the static door below covers src/, e2e/ and .storybook/).
      'no-restricted-syntax': ['error', ...MEMO_BANS, ...dynamicImportBans(UI_PACKAGE_DOOR)],
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
      'inkweave/no-unloaded-font-weight': 'error',
      'inkweave/no-raw-radius': 'error',
      'inkweave/no-raw-z-index': 'error',
      'inkweave/no-raw-easing': 'error',
      'inkweave/no-backdrop-filter': 'error',
      'inkweave/no-adhoc-buttons': 'error',
      'inkweave/no-unshelled-dialogs': 'error',
      'inkweave/no-dim-text': 'error',
      'inkweave/no-raw-spacing': 'error',
    },
  },
  // React Compiler builds the components and hooks under src/ (vite.config.ts), in stories and
  // tests too, and skips code that opts out of its checks without a word (#937).
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: {inkweave},
    rules: {'inkweave/no-compiler-opt-out': 'error'},
  },
  // No-new-styling-infrastructure + use-the-barrel guards (#508), and inkweave-ui's door.
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: STYLING_BANS,
          patterns: [
            {
              group: ['**/shared/constants/theme', '**/shared/constants/playstyleUi'],
              message: 'Import tokens through the barrel (shared/constants), not the theme files directly.',
            },
            ...UI_PACKAGE_DOOR,
          ],
        },
      ],
    },
  },
  // The app imports only types from the engine's root (#930): its display text comes from
  // `inkweave-synergy-engine/catalog.json` (features/synergies/engineCatalog.ts) and its card
  // helpers from `inkweave-synergy-engine/card`, so no rule or detector reaches the bundle.
  // Precompute runs the detectors at build time. Tests and stories may import the whole engine.
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/**/__tests__/**', 'src/**/*.test.{ts,tsx}', 'src/**/*.stories.tsx', 'src/shared/test-utils/**'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'inkweave-synergy-engine',
              allowTypeImports: true,
              message:
                "Import types only: values come from features/synergies/engineCatalog or 'inkweave-synergy-engine/card', so the engine's rules stay out of the bundle.",
            },
          ],
        },
      ],
    },
  },
  // The e2e specs and Storybook's config reach inkweave-ui through its exports too.
  {
    files: ['e2e/**/*.ts', '.storybook/**/*.{ts,tsx}'],
    rules: {'no-restricted-imports': ['error', {patterns: UI_PACKAGE_DOOR}]},
  },
  storybook.configs['flat/recommended'],
);
