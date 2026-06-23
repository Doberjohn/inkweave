// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import storybook from 'eslint-plugin-storybook';

import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import reactCompiler from 'eslint-plugin-react-compiler';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import tseslint from 'typescript-eslint';

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
  storybook.configs['flat/recommended'],
);
