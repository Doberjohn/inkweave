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
    ok("const COLORS = {primary: '#ffb900'};", '/repo/apps/web/src/shared/constants/theme.ts'),
  ],
  invalid: [
    hex("const s = {color: '#fff'};"),
    hex("const s = {color: '#ffb900'};"),
    hex("const s = {color: '#ffb90080'};"),
    hex('const s = {border: `1px solid #333355`};'),
    // It takes 3 to 8 digits, so it can't tell an issue ref in a string from a short hex
    // (#546). Six digits only would let '#fff' through; keep refs in comments instead.
    hex('const label = `see #511`;'),
  ],
});
