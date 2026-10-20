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
const dim = (code) => ({code, filename: FILE, errors: [{message: /COLORS\.textDim as text/}]});
const ok = (code, filename = FILE) => ({code, filename});

ruleTester.run('no-dim-text', inkweave.rules['no-dim-text'], {
  valid: [
    ok('const s = {borderColor: COLORS.textDim};'),
    ok('const s = {stroke: COLORS.textDim};'),
    ok('const s = {border: `1px dashed ${COLORS.textDim}`};'),
    ok('const s = {color: disabled ? COLORS.textDim : color};'),
    ok('const s = {color: isDisabled ? COLORS.textDim : COLORS.text};'),
    ok('const e = <span aria-hidden="true" style={{color: COLORS.textDim}}>/</span>;'),
    ok('const e = <span aria-hidden style={{color: COLORS.textDim}}>·</span>;'),
    ok('const s = {color: COLORS.textMuted};'),
    ok('const s = {color: COLORS.textDim};', '/repo/apps/web/src/shared/constants/theme.ts'),
  ],
  invalid: [
    dim('const e = <span style={{color: COLORS.textDim}}>12</span>;'),
    dim('const LABEL = {color: COLORS.textDim};'),
    dim('const s = {color: active ? COLORS.text : COLORS.textDim};'),
    // Only the disabled branch is exempt: here textDim colours the enabled state.
    dim('const s = {color: disabled ? color : COLORS.textDim};'),
    dim('const s = {color: hexRgba(COLORS.textDim, 0.8)};'),
    dim('const s = {WebkitTextFillColor: COLORS.textDim};'),
    dim('const e = <span aria-hidden={false} style={{color: COLORS.textDim}}>12</span>;'),
  ],
});
