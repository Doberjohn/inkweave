// @vitest-environment node
// no-raw-font-size, no-literal-font-family, no-raw-radius and no-raw-z-index, which read both
// branches of a ternary as no-raw-spacing does.
import {RuleTester} from 'eslint';
import {describe, it} from 'vitest';
import {inkweave} from './index.js';

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const ruleTester = new RuleTester({
  languageOptions: {parserOptions: {ecmaFeatures: {jsx: true}}},
});

const FILE = '/repo/apps/web/src/features/demo/Demo.tsx';
const ok = (code) => ({code, filename: FILE});
const flagged =
  (message) =>
  (code, count = 1) => ({
    code,
    filename: FILE,
    errors: Array.from({length: count}, () => ({message})),
  });

const size = flagged(/Raw font size/);
ruleTester.run('no-raw-font-size', inkweave.rules['no-raw-font-size'], {
  valid: [
    ok('const s = {fontSize: FONT_SIZES.lg};'),
    ok('const s = {fontSize: isMobile ? FONT_SIZES.xl : FONT_SIZES.xxl};'),
    ok('const s = {fontSize: isMobile ? PHONE_TITLE_SIZE : FONT_SIZES.xxxl};'),
  ],
  invalid: [
    size('const s = {fontSize: 18};'),
    size("const s = {fontSize: '18px'};"),
    size('const s = {fontSize: isMobile ? 18 : FONT_SIZES.xxxl};'),
    size('const e = <p style={{fontSize: compact ? 12 : 13}} />;', 2),
    size('const s = {fontSize: a ? FONT_SIZES.sm : b ? 15 : FONT_SIZES.lg};'),
  ],
});

const family = flagged(/Literal font-family/);
ruleTester.run('no-literal-font-family', inkweave.rules['no-literal-font-family'], {
  valid: [
    ok('const s = {fontFamily: FONTS.body};'),
    ok("const s = {fontFamily: hero ? FONTS.hero : 'inherit'};"),
  ],
  invalid: [
    family("const s = {fontFamily: 'Arial'};"),
    family("const s = {fontFamily: hero ? 'Georgia, serif' : FONTS.body};"),
  ],
});

const radius = flagged(/Raw border radius/);
ruleTester.run('no-raw-radius', inkweave.rules['no-raw-radius'], {
  valid: [
    ok('const s = {borderRadius: RADIUS.pill};'),
    ok('const s = {borderRadius: round ? RADIUS.pill : RADIUS.sm};'),
    ok("const s = {borderRadius: round ? '50%' : RADIUS.sm};"),
  ],
  invalid: [
    radius('const s = {borderRadius: 999};'),
    radius('const s = {borderRadius: round ? 10 : RADIUS.sm};'),
    radius('const s = {borderRadius: round ? 999 : 4};', 2),
  ],
});

const layer = flagged(/Raw app-layer z-index/);
ruleTester.run('no-raw-z-index', inkweave.rules['no-raw-z-index'], {
  valid: [
    ok('const s = {zIndex: Z_INDEX.promoCard};'),
    // Local stacking below 50 stays a plain number, on either branch.
    ok('const s = {zIndex: raised ? 2 : 1};'),
    ok('const s = {zIndex: open ? Z_INDEX.popover : 0};'),
  ],
  invalid: [
    layer('const s = {zIndex: 800};'),
    layer('const s = {zIndex: open ? 800 : 0};'),
    layer('const s = {zIndex: open ? 1100 : 900};', 2),
  ],
});
