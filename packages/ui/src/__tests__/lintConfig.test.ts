// @vitest-environment node
import path from 'node:path';
import {ESLint} from 'eslint';

const PACKAGE = path.resolve(import.meta.dirname, '../..');
const APP = path.resolve(PACKAGE, '../../apps/web');

const eslints = new Map<string, ESLint>();

// Loading a config (typescript-eslint, React Compiler's Babel, jsx-a11y) takes seconds, more
// while the pre-commit hook lints beside the tests, so it happens once here, outside any
// test's 5 s timeout.
beforeAll(async () => {
  for (const cwd of [PACKAGE, APP]) {
    const eslint = new ESLint({cwd});
    await eslint.lintText('export {};\n', {filePath: path.join(cwd, 'src/Warmup.tsx')});
    eslints.set(cwd, eslint);
  }
}, 120_000);

/** The rule ids and messages ESLint reports for `code`, linted as if it were `file` under `cwd`. */
async function lint(cwd: string, file: string, code: string) {
  const [result] = await eslints.get(cwd)!.lintText(code, {filePath: path.join(cwd, file)});
  return result.messages.map(({ruleId, message}) => ({ruleId, message}));
}

const COMPONENT = 'src/components/Probe.tsx';
const imports = (source: string) => `import probe from '${source}';\nexport const used = probe;\n`;

describe("inkweave-ui's lint config", () => {
  it.each([
    ['the app by path', '../../../apps/web/src/shared/constants', 'never imports the app'],
    ['the app by name', 'inkweave-web/src/App', 'never imports the app'],
    ['the router', 'react-router', 'never routes'],
    ['Supabase', '@supabase/supabase-js', 'never fetches app data'],
    ['analytics', '@vercel/analytics', 'never reports analytics'],
    ['PostHog', 'posthog-js', 'never reports analytics'],
    ['Sentry', '@sentry/react', 'never reports analytics'],
    ['a CSS-in-JS library', 'styled-components', 'no CSS-in-JS'],
  ])('stops package source importing %s', async (_what, source, message) => {
    const messages = await lint(PACKAGE, COMPONENT, imports(source));
    expect(messages).toContainEqual({
      ruleId: 'no-restricted-imports',
      message: expect.stringContaining(message),
    });
  });

  it.each([
    ['the router', "import('react-router')", 'never routes'],
    ['Sentry', 'import(`@sentry/${name}`)', 'never reports analytics'],
    ['the app by path', "import('../../../apps/web/src/main')", 'never imports the app'],
    ['the router, miscased', "import('React-Router')", 'never routes'],
  ])('stops package source importing %s lazily', async (_what, load, message) => {
    const code = `const name = 'react';\nexport const load = () => ${load};\n`;
    const messages = await lint(PACKAGE, COMPONENT, code);
    expect(messages).toContainEqual({
      ruleId: 'no-restricted-syntax',
      message: expect.stringContaining(message),
    });
  });

  it.each([
    ['the router', "typeof import('react-router')", 'never routes'],
    ['the app', "import('../../../apps/web/src/main').Root", 'never imports the app'],
  ])('stops package source taking a type from %s by import()', async (_what, type, message) => {
    const messages = await lint(PACKAGE, COMPONENT, `export type Probe = ${type};\n`);
    expect(messages).toContainEqual({
      ruleId: 'no-restricted-syntax',
      message: expect.stringContaining(message),
    });
  });

  it("holds package source to the app's design-token and compiler rules", async () => {
    const code =
      "import {useMemo} from 'react';\nexport const color = '#123456';\nexport const v = () => useMemo(() => 1, []);\n";
    const rules = (await lint(PACKAGE, COMPONENT, code)).map(({ruleId}) => ruleId);
    expect(rules).toEqual(
      expect.arrayContaining(['inkweave/no-raw-hex-colors', 'no-restricted-syntax']),
    );
  });

  it("fails a component React Compiler would skip, as admin's lint does", async () => {
    const code = [
      "import {useState} from 'react';",
      'export function Probe() {',
      '  const [count] = useState(0);',
      '  try {',
      '    return <span>{count}</span>;',
      '  } finally {',
      "    console.debug('rendered');",
      '  }',
      '}',
      '',
    ].join('\n');
    const rules = (await lint(PACKAGE, COMPONENT, code)).map(({ruleId}) => ruleId);
    expect(rules).toContain('react-hooks/todo');
  });

  it('passes clean package source', async () => {
    const code =
      "import {useState} from 'react';\nexport function useCount() {\n  return useState(0);\n}\n";
    expect(await lint(PACKAGE, 'src/hooks/useCount.ts', code)).toEqual([]);
  });
});

describe("the app's door into inkweave-ui", () => {
  it.each([
    ['src/App.tsx', 'inkweave-ui'],
    ['src/App.tsx', 'inkweave-ui/src/components/CtaButton'],
    ['src/App.tsx', '../../../packages/ui/src/components/CtaButton'],
    ['e2e/probe.spec.ts', 'inkweave-ui/src/tokens/theme'],
    ['.storybook/preview.tsx', '../../packages/ui/src/tokens/theme'],
  ])('stops %s importing %s', async (file, source) => {
    const rules = (await lint(APP, file, imports(source))).map(({ruleId}) => ruleId);
    expect(rules).toContain('no-restricted-imports');
  });

  it.each([
    ['src/App.tsx', "import('inkweave-ui')"],
    ['src/App.tsx', "import('Inkweave-UI')"],
    ['src/App.tsx', "import('../../../packages/ui/src/components/CtaButton')"],
    ['src/App.tsx', 'import(`../../packages/ui/src/components/${name}`)'],
    ['e2e/probe.spec.ts', "import('inkweave-ui/src/tokens/theme')"],
    ['.storybook/preview.tsx', "import('../../packages/ui/src/tokens/theme')"],
  ])('stops %s importing lazily with %s', async (file, load) => {
    const code = `const name = 'CtaButton';\nexport const load = () => ${load};\n`;
    const rules = (await lint(APP, file, code)).map(({ruleId}) => ruleId);
    expect(rules).toContain('no-restricted-syntax');
  });

  it('lets the app import a subpath from the exports map', async () => {
    const code = `${imports('inkweave-ui/components/CtaButton')}export const load = () => import('inkweave-ui/hooks/useHover');\n`;
    const rules = (await lint(APP, 'src/App.tsx', code)).map(({ruleId}) => ruleId);
    expect(rules).not.toContain('no-restricted-imports');
    expect(rules).not.toContain('no-restricted-syntax');
  });
});
