// @vitest-environment node
import {describe, it} from 'vitest';
import {RuleTester} from 'eslint';
import {inkweave} from './index.js';

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const ruleTester = new RuleTester({
  languageOptions: {parserOptions: {ecmaFeatures: {jsx: true}}},
});

const FILE = '/repo/apps/web/src/features/demo/Demo.tsx';
const hex = (code) => ({code, filename: FILE, errors: [{message: /Raw hex color/}]});
const ok = (code, filename = FILE) => ({code, filename});

ruleTester.run('no-raw-hex-colors', inkweave.rules['no-raw-hex-colors'], {
  valid: [
    ok('const s = {color: COLORS.primary};'),
    // Comments are never scanned, so an issue ref there is safe.
    ok('const s = {color: COLORS.primary}; // #511'),
    ok("const COLORS = {primary: '#ffb900'};", '/repo/packages/ui/src/tokens/theme.ts'),
    ok("const COLORS = {primary: '#ffb900'};", 'C:\\repo\\packages\\ui\\src\\tokens\\theme.ts'),
    ok("const INK = {Amber: {bg: '#f5b202'}};", '/repo/packages/ui/src/tokens/lorcana.ts'),
  ],
  invalid: [
    hex("const s = {color: '#fff'};"),
    hex("const s = {color: '#ffb900'};"),
    hex("const s = {color: '#ffb90080'};"),
    hex('const s = {border: `1px solid #333355`};'),
    // It takes 3 to 8 digits, so it can't tell an issue ref in a string from a short hex
    // (#546). Six digits only would let '#fff' through; keep refs in comments instead.
    hex('const label = `see #511`;'),
    // The exemptions name repo paths exactly: the app's constants, where the tokens lived until
    // #978, and admin's files (admin lints with these rules) get no pass from sharing a name with
    // an exempt file, nor do inkweave-ui's components.
    {...hex("const s = {color: '#ffb900'};"), filename: '/repo/apps/web/src/shared/constants/appConstants.ts'},
    {...hex("const s = {color: '#ffb900'};"), filename: '/repo/apps/web/src/shared/constants/theme.ts'},
    {...hex("const s = {color: '#ffb900'};"), filename: '/repo/packages/ui/src/components/Demo.tsx'},
    {...hex("const s = {color: '#ffb900'};"), filename: '/repo/packages/ui/src/shared/constants/theme.ts'},
    {...hex("const s = {color: '#ffb900'};"), filename: '/work/inkweave-admin/src/shared/constants/theme.ts'},
  ],
});
