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
    // A story or test may draw an aria-modal surface; only Radix stays out of them.
    {code: ARIA_MODAL, filename: '/repo/packages/ui/src/components/Demo.stories.tsx'},
    {code: ARIA_MODAL, filename: '/repo/apps/web/src/features/demo/Demo.test.tsx'},
  ],
  invalid: [
    {
      code: ARIA_MODAL,
      filename: '/repo/apps/web/src/shared/components/CardFilterDialog.tsx',
      errors: [{message: /^aria-modal without/}],
    },
    // Only the package's FilterDialog is the exception; an app file of the same name is not.
    {
      code: ARIA_MODAL,
      filename: '/repo/apps/web/src/shared/components/FilterDialog.tsx',
      errors: [{message: /^aria-modal without/}],
    },
    radix('/repo/packages/ui/src/lorcana/FilterDialog.tsx'),
    radix('/repo/apps/web/src/features/demo/Demo.tsx'),
    // The overlay contract's other entry points, and the files it exempts from aria-modal, still
    // keep Radix out.
    radix('/repo/packages/ui/src/components/DialogShell.tsx'),
    radix('/repo/packages/ui/src/components/FilterDialog.stories.tsx'),
    radix('/repo/packages/ui/src/components/__tests__/FilterDialog.test.tsx'),
  ],
});
