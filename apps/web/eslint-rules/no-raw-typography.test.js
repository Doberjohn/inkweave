// @vitest-environment node
// no-raw-font-weight, no-raw-letter-spacing and no-raw-line-height: typography's three scales.
import {describe, it} from 'vitest';
import {RuleTester} from 'eslint';
import {inkweave} from './index.js';
import {KNOWN_OFFENDERS} from './known-offenders.js';

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const ruleTester = new RuleTester({
  languageOptions: {parserOptions: {ecmaFeatures: {jsx: true}}},
});

const FILE = '/repo/apps/web/src/features/demo/Demo.tsx';
const ok = (code, filename = FILE) => ({code, filename});
const flagged =
  (message) =>
  (code, count = 1) => ({
    code,
    filename: FILE,
    errors: Array.from({length: count}, () => ({message})),
  });
/**
 * A file `rule`'s ledger holds and `other`'s doesn't, whichever comes first: the ledgers only
 * shrink, so no one entry can be named. Throws once none is left, so the cases say why they broke.
 */
const ledgeredOnly = (rule, other) => {
  const entry = KNOWN_OFFENDERS[rule].find((file) => !KNOWN_OFFENDERS[other].includes(file));
  if (!entry)
    throw new Error(`Every ${rule} ledger file is in ${other}'s too: name a fixture file here.`);
  return `/repo/${entry}`;
};

const weight = flagged(/Raw font weight/);
ruleTester.run('no-raw-font-weight', inkweave.rules['no-raw-font-weight'], {
  valid: [
    ok('const s = {fontWeight: FONT_WEIGHT.bold};'),
    ok('const s = {fontWeight: active ? FONT_WEIGHT.semibold : FONT_WEIGHT.regular};'),
    ok("const s = {fontWeight: 'inherit'}; const t = {fontWeight: 'revert-layer'};"),
    ok('const s = {fontWeight: weight};'),
    // Tests pin whatever weight they assert on.
    ok('const s = {fontWeight: 700};', '/repo/apps/web/src/features/demo/Demo.test.tsx'),
  ],
  invalid: [
    weight('const s = {fontWeight: 700};'),
    weight("const s = {fontWeight: '600'};"),
    weight("const s = {fontWeight: 'bold'};"),
    // `normal` is a weight, 400: FONT_WEIGHT.regular.
    weight("const s = {fontWeight: 'normal'};"),
    weight('const s = {fontWeight: active ? 700 : FONT_WEIGHT.regular};'),
    weight('const e = <b style={{fontWeight: compact ? 500 : 600}} />;', 2),
    // Stories are held to it too: every weight is already one of the four faces.
    {
      ...weight('const s = {fontWeight: 700};'),
      filename: '/repo/apps/web/src/features/demo/Demo.stories.tsx',
    },
  ],
});

const spacing = flagged(/Raw letter spacing/);
ruleTester.run('no-raw-letter-spacing', inkweave.rules['no-raw-letter-spacing'], {
  valid: [
    ok('const s = {letterSpacing: LETTER_SPACING.cap};'),
    ok('const s = {letterSpacing: wide ? LETTER_SPACING.wide : LETTER_SPACING.slight};'),
    ok(
      "const s = {letterSpacing: 'normal'}; const t = {letterSpacing: 0}; const u = {letterSpacing: '0'};",
    ),
    ok("const s = {letterSpacing: '0.5px'};", '/repo/apps/web/src/features/demo/Demo.stories.tsx'),
    ok("const s = {letterSpacing: '0.5px'};", '/repo/packages/ui/src/docs/tokens.ts'),
    ok("const s = {letterSpacing: 'revert'};"),
    ok(
      "const s = {letterSpacing: '0.5px'};",
      ledgeredOnly('no-raw-letter-spacing', 'no-raw-line-height'),
    ),
  ],
  invalid: [
    spacing("const s = {letterSpacing: '0.05em'};"),
    spacing("const s = {letterSpacing: '0.5px'};"),
    spacing('const s = {letterSpacing: 1};'),
    spacing('const s = {letterSpacing: -0.5};'),
    spacing("const s = {letterSpacing: big ? '0.12em' : LETTER_SPACING.cap};"),
    // The ledger exempts only its own rule's files.
    {
      ...spacing("const s = {letterSpacing: '0.5px'};"),
      filename: ledgeredOnly('no-raw-line-height', 'no-raw-letter-spacing'),
    },
  ],
});

const leading = flagged(/Raw line height/);
ruleTester.run('no-raw-line-height', inkweave.rules['no-raw-line-height'], {
  valid: [
    ok('const s = {lineHeight: LINE_HEIGHT.snug};'),
    ok(
      'const s = {lineHeight: 1}; const t = {lineHeight: 0}; const u = {lineHeight: LINE_HEIGHT.none};',
    ),
    ok(
      "const s = {lineHeight: 'normal'}; const t = {lineHeight: '1'}; const u = {lineHeight: '0'};",
    ),
    ok('const s = {lineHeight: dense ? 1 : LINE_HEIGHT.base};'),
    ok('const s = {lineHeight: 1.55};', '/repo/apps/web/src/features/demo/Demo.stories.tsx'),
    ok(
      'const s = {lineHeight: 1.55};',
      ledgeredOnly('no-raw-line-height', 'no-raw-letter-spacing'),
    ),
  ],
  invalid: [
    leading('const s = {lineHeight: 1.5};'),
    leading('const s = {lineHeight: 1.55};'),
    leading("const s = {lineHeight: '20px'};"),
    leading("const s = {lineHeight: '1.5'};"),
    // A negative line height is invalid CSS, so -1 is no 1.
    leading('const s = {lineHeight: -1};'),
    leading('const e = <p style={{lineHeight: dense ? 1.3 : 1.7}} />;', 2),
  ],
});
