// @vitest-environment node
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
const raw = (code, count = 1) => ({
  code,
  filename: FILE,
  errors: Array.from({length: count}, () => ({message: /Raw spacing/})),
});
const ok = (code) => ({code, filename: FILE});
// Any ledger entry: it only shrinks, so the test takes whichever is first.
const LEDGERED = KNOWN_OFFENDERS['no-raw-spacing'][0];
const under = (prefix) => `/repo/${prefix}${LEDGERED.slice('apps/web/'.length)}`;
const exempt = (filename) => ({code: 'const s = {padding: 30};', filename, name: `exempt: ${filename}`});

ruleTester.run('no-raw-spacing', inkweave.rules['no-raw-spacing'], {
  valid: [
    ok('const s = {padding: SPACING.md, margin: 0};'),
    ok('const s = {gap: compact ? SPACING.sm : SPACING.md};'),
    ok('const s = {marginTop: -SPACING.md, marginLeft: -0};'),
    // Exempt: stories and inkweave-ui's src/docs/ showcase (fixtures, not product), and tests.
    exempt('/repo/apps/web/src/features/demo/Demo.stories.tsx'),
    exempt('/repo/packages/ui/src/docs/tokens.ts'),
    exempt('/repo/apps/web/src/features/demo/Demo.test.tsx'),
    exempt('C:\\repo\\apps\\web\\src\\features\\demo\\Demo.stories.tsx'),
    exempt('/repo/packages/ui/src/components/Demo.stories.tsx'),
    // A ledger entry (known-offenders.js) is one repo path.
    exempt(under('apps/web/')),
  ],
  invalid: [
    raw('const s = {padding: 30};'),
    raw('const e = <div style={{gap: 6}} />;'),
    raw('const s = {gap: compact ? 14 : 20};', 2),
    raw('const s = {gap: isMobile ? SPACING.sm : 10};'),
    raw('const s = {marginTop: a ? 8 : b ? 12 : 16};', 3),
    raw('const s = {paddingInline: 12, marginBlockStart: 4};', 2),
    raw('const s = {marginTop: -14};'),
    raw('const s = {marginLeft: isMobile ? -4 : -SPACING.sm};'),
    // A ledger entry names one repo path: an app entry's path under inkweave-ui, or under a folder
    // that merely ends in it, is held to the rule.
    {...raw('const s = {padding: 30};'), filename: '/repo/packages/ui/src/components/Demo.tsx'},
    {...raw('const s = {padding: 30};'), filename: under('packages/ui/')},
    {...raw('const s = {padding: 30};'), filename: under('apps/web/old/')},
  ],
});
