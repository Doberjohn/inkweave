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

const RADIX = "import * as Dialog from '@radix-ui/react-dialog';";
const ARIA_MODAL = 'const e = <div role="dialog" aria-modal="true" />;';
const EXCEPTION = '/repo/packages/ui/src/components/FilterDialog.tsx';
const radix = (filename) => ({code: RADIX, filename, errors: [{message: /^Radix Dialog outside/}]});

ruleTester.run('no-unshelled-dialogs', inkweave.rules['no-unshelled-dialogs'], {
  valid: [
    {code: RADIX, filename: EXCEPTION},
    {
      code: `import {DialogShell} from 'inkweave-ui/components/DialogShell';\n${ARIA_MODAL}`,
      filename: '/repo/apps/web/src/features/demo/Demo.tsx',
    },
  ],
  invalid: [
    {
      code: ARIA_MODAL,
      filename: '/repo/apps/web/src/shared/components/CardFilterDialog.tsx',
      errors: [{message: /^aria-modal without/}],
    },
    // The exception moved with the file (#981): its old path is a file like any other.
    {
      code: ARIA_MODAL,
      filename: '/repo/apps/web/src/shared/components/FilterDialog.tsx',
      errors: [{message: /^aria-modal without/}],
    },
    radix('/repo/packages/ui/src/lorcana/FilterDialog.tsx'),
    radix('/repo/apps/web/src/features/demo/Demo.tsx'),
  ],
});
