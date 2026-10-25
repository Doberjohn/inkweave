// inkweave-ui lints with the app's own config, so a component, a test or a story gets the same
// rules here as in apps/web: React Compiler's checks, the useMemo/useCallback ban and every
// design-token rule (#508). The block below replaces the app's import restrictions with the
// package's: the same styling bans, plus what package source never reaches.
import appConfig, {STYLING_BANS} from '../../apps/web/eslint.config.js';

const APP =
  'inkweave-ui never imports the app: move the module into the package, or take the value as a prop.';

// The app, and anything that ties a component to one app's routing, data, analytics or error
// reporting. Those stay in the app, behind a prop or a context the app fills.
const BOUNDARY = [
  {regex: '(^|/)apps/web(/|$)', message: APP},
  {regex: '^inkweave-web(/|$)', message: APP},
  {
    regex: '^react-router(-dom)?(/|$)',
    message: 'inkweave-ui never routes: take an href or a callback from the app.',
  },
  {regex: '^@supabase/', message: 'inkweave-ui never fetches app data: take the data as a prop.'},
  {
    regex: '^(@vercel/|posthog-js(/|$)|@sentry/)',
    message: 'inkweave-ui never reports analytics or errors: take a callback from the app.',
  },
];

// React Compiler skips a function it can't compile, and the build says nothing. Admin holds its
// source to these bailout rules (Doberjohn/inkweave-admin#59) and compiles this package's too, so
// the package holds its shipped source to them as well: the app's config leaves them off or at
// warn, which the commit gate lets through.
const COMPILER_BAILOUTS = Object.fromEntries(
  ['todo', 'invariant', 'syntax', 'unsupported-syntax', 'incompatible-library'].map((rule) => [
    `react-hooks/${rule}`,
    'error',
  ]),
);

export default [
  ...appConfig,
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {'no-restricted-imports': ['error', {paths: STYLING_BANS, patterns: BOUNDARY}]},
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['**/*.test.{ts,tsx}', '**/__tests__/**'],
    rules: COMPILER_BAILOUTS,
  },
];
