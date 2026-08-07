import {RuleTester} from 'eslint';
// The rules file is plain JS with no types, and giving it a .d.ts to satisfy one
// import would be more machinery than the import is worth.
// @ts-expect-error -- untyped ESLint plugin, imported only to test its behaviour
import {inkweave} from '../../../../eslint-rules/index.js';

/*
  The rule is the only thing standing between one back-navigation shape and the five
  the census found on 2026-08-07. It had no test, and a lint rule that silently stops
  matching is indistinguishable from a codebase that never violates it.

  RuleTester emits its own describe/it, so it runs at the top level — nesting it
  inside a test throws "Calling the suite function inside test function".
*/
const tester = new RuleTester({
  languageOptions: {ecmaVersion: 2022, sourceType: 'module', parserOptions: {ecmaFeatures: {jsx: true}}},
});

const ERRORS = [{message: /Hand-rolled back navigation/}];

tester.run('inkweave/no-adhoc-back-links', inkweave.rules['no-adhoc-back-links'], {
  valid: [
    // The import is the sanction: the rule trusts a file that reached for BackLink.
    {
      filename: 'src/pages/SomePage.tsx',
      code: `import {BackLink} from './BackLink';\nconst A = () => <BackLink to="/decks" label="Back to decks" />;`,
    },
    // Nothing back-shaped at all.
    {filename: 'src/pages/SomePage.tsx', code: `const A = () => <div>Decks</div>;`},
    // Exempt: a terminal screen's last remaining action stays a CtaButton.
    {filename: 'src/pages/VotePage.tsx', code: `const A = () => <CtaButton>Back to Home</CtaButton>;`},
  ],
  invalid: [
    // JSX text, the plainest shape.
    {
      filename: 'src/pages/SomePage.tsx',
      code: `const A = () => <a href="/decks">Back to decks</a>;`,
      errors: ERRORS,
    },
    // A string PROP — what a JSXText-only rule would miss, and how three of the
    // census sites were written.
    {filename: 'src/pages/SomePage.tsx', code: `const A = () => <Thing label="Back to decks" />;`, errors: ERRORS},
    // A bare arrow, which is how a back link reads before anyone writes the words.
    {filename: 'src/pages/SomePage.tsx', code: `const A = () => <button>← Back</button>;`, errors: ERRORS},
  ],
});
