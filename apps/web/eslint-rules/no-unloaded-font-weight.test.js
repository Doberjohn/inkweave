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
const unloaded = (code, count = 1) => ({
  code,
  filename: FILE,
  errors: Array.from({length: count}, () => ({message: /No face is loaded for this weight/})),
});
const hero = (code, count = 1) => ({
  code,
  filename: FILE,
  errors: Array.from({length: count}, () => ({message: /ships 400 only/})),
});
const ok = (code, filename = FILE) => ({code, filename});

ruleTester.run('no-unloaded-font-weight', inkweave.rules['no-unloaded-font-weight'], {
  valid: [
    ok('const s = {fontWeight: 400}; const t = {fontWeight: 500}; const u = {fontWeight: 600}; const v = {fontWeight: 700};'),
    ok("const s = {fontWeight: 'bold'}; const t = {fontWeight: '600'};"),
    ok('const s = {fontWeight: active ? 700 : 400};'),
    ok('const s = {fontWeight: weight};'),
    ok('const s = {fontFamily: FONTS.hero, fontWeight: 400};'),
    ok("const s = {fontFamily: FONTS.hero, fontWeight: 'normal'};"),
    ok('const s = {fontFamily: FONTS.hero, fontSize: FONT_SIZES.xxl};'),
    ok('const s = {fontFamily: FONTS.body, fontWeight: 700};'),
    // A dynamic key could name any family, whatever the variable is called.
    ok('const s = {fontFamily: FONTS[hero], fontWeight: 700};'),
    ok('const e = <h2 style={{fontFamily: FONTS.hero, fontWeight: 400}}>Title</h2>;'),
    // Tests pin whatever weight they assert on.
    ok('const s = {fontWeight: 800};', '/repo/apps/web/src/features/demo/Demo.test.tsx'),
  ],
  invalid: [
    unloaded('const s = {fontWeight: 800};'),
    unloaded("const s = {fontWeight: '900'};"),
    unloaded('const s = {fontWeight: 300};'),
    unloaded('const s = {fontWeight: big ? 800 : 400};'),
    unloaded('const e = <div style={{fontWeight: 800, fontSize: FONT_SIZES.displayMd}} />;'),
    hero('const s = {fontFamily: FONTS.hero, fontWeight: 700};'),
    hero("const s = {fontFamily: FONTS['hero'], fontWeight: 700};"),
    hero("const s = {fontWeight: 'bold', fontFamily: FONTS.hero};"),
    hero('const s = {fontFamily: FONTS.hero, fontWeight: 800};'),
    hero('const s = {fontFamily: FONTS.hero, fontWeight: compact ? 600 : 700};', 2),
    hero('const e = <h3 style={{fontFamily: FONTS.hero, fontWeight: 700, fontSize: 22}}>Title</h3>;'),
  ],
});
