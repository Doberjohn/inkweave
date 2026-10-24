// @vitest-environment node
import {describe, it} from 'vitest';
import {RuleTester} from 'eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import {inkweave} from './index.js';

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

// The comments name react-hooks rules, which ESLint reports as unknown unless the plugin is loaded.
const ruleTester = new RuleTester({
  plugins: {'react-hooks': reactHooks},
  languageOptions: {parserOptions: {ecmaFeatures: {jsx: true}}},
});

const FILE = '/repo/apps/web/src/features/demo/Demo.tsx';
const turnedOff = (code, rules) => ({code, filename: FILE, errors: [{message: new RegExp(`^Don't turn off ${rules}\\.`)}]});
const optedOut = (code, directive) => ({code, filename: FILE, errors: [{message: new RegExp(`^'${directive}' opts this code out`)}]});
const ok = (code) => ({code, filename: FILE});

ruleTester.run('no-compiler-opt-out', inkweave.rules['no-compiler-opt-out'], {
  valid: [
    ok('// eslint-disable-next-line no-console\nconsole.log(1);'),
    ok('/* eslint no-console: off */\nconsole.log(1);'),
    ok('/* eslint-enable react-hooks/exhaustive-deps */'),
    // Turning a check up keeps it on.
    ok('/* eslint react-hooks/todo: error */'),
    ok('/* eslint react-hooks/todo: ["error"] */'),
    // A bare disable names no rule, and eslint-plugin-react-compiler let it through too.
    ok('// eslint-disable-next-line\nconsole.log(1);'),
    ok('// react-hooks/exhaustive-deps stays on here'),
    ok("'use strict';\nfunction Demo() { return <div />; }"),
    ok("const label = 'use no memo';"),
    // Only a directive opts out: a string statement after the first statement isn't one.
    ok("function Demo() { const n = 1; 'use no memo'; return <div>{n}</div>; }"),
  ],
  invalid: [
    turnedOff('useEffect(() => {\n  // eslint-disable-next-line react-hooks/exhaustive-deps\n}, []);', 'react-hooks/exhaustive-deps'),
    turnedOff('useEffect(() => {}, []); // eslint-disable-line react-hooks/exhaustive-deps', 'react-hooks/exhaustive-deps'),
    turnedOff('/* eslint-disable react-hooks/rules-of-hooks */', 'react-hooks/rules-of-hooks'),
    turnedOff('// eslint-disable-next-line react-hooks/exhaustive-deps -- only on mount', 'react-hooks/exhaustive-deps'),
    turnedOff('// eslint-disable-next-line no-console, react-hooks/refs', 'react-hooks/refs'),
    turnedOff(
      '/* eslint-disable react-hooks/refs, react-hooks/immutability */',
      'react-hooks/refs, react-hooks/immutability',
    ),
    turnedOff('/* eslint react-hooks/immutability: off */', 'react-hooks/immutability'),
    turnedOff('/* eslint no-console: off, react-hooks/purity: "warn" */', 'react-hooks/purity'),
    turnedOff('/* eslint react-hooks/refs: 0 */', 'react-hooks/refs'),
    turnedOff("/* eslint react-hooks/refs: ['warn'] */", 'react-hooks/refs'),
    optedOut("function Demo() { 'use no memo'; return <div />; }", 'use no memo'),
    optedOut("function useDemo() { 'use no forget'; return 1; }", 'use no forget'),
    optedOut("'use no memo';\nexport function Demo() { return <div />; }", 'use no memo'),
    optedOut("const Demo = () => { 'use no memo'; return <div />; };", 'use no memo'),
  ],
});
