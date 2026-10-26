// @vitest-environment node
import {existsSync, statSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {describe, expect, it} from 'vitest';
import * as exemptions from './exemptions.js';
import {KNOWN_OFFENDERS} from './known-offenders.js';

const {ADHOC_BUTTON_EXEMPT, COLOR_EXEMPT, SPACING_EXEMPT, isExempt, isUnder, relName} = exemptions;
const REPO = fileURLToPath(new URL('../../../', import.meta.url));
const at = (filename) => ({filename});

const TABLES = Object.entries(exemptions).filter(([, value]) => Array.isArray(value?.paths));
const LEDGER = Object.entries(KNOWN_OFFENDERS).flatMap(([rule, files]) =>
  files.map((file) => [rule, file]),
);

describe('relName', () => {
  it('names an app or inkweave-ui file from the repo root, on any OS', () => {
    expect(relName(at('/repo/apps/web/src/App.tsx'))).toBe('apps/web/src/App.tsx');
    expect(relName(at('C:\\repo\\packages\\ui\\src\\components\\X.tsx'))).toBe(
      'packages/ui/src/components/X.tsx',
    );
  });

  it('cuts at the last apps/web or packages/ui, so a checkout under either name works', () => {
    expect(relName(at('/home/me/apps/web/inkweave/apps/web/src/App.tsx'))).toBe(
      'apps/web/src/App.tsx',
    );
    expect(relName(at('/srv/packages/ui/inkweave/packages/ui/src/tokens/theme.ts'))).toBe(
      'packages/ui/src/tokens/theme.ts',
    );
  });

  it('keeps any other file absolute, so no entry can match it', () => {
    expect(relName(at('/work/inkweave-admin/src/App.tsx'))).toBe(
      '/work/inkweave-admin/src/App.tsx',
    );
  });
});

describe('isUnder', () => {
  it('reads an entry ending in "/" as a folder', () => {
    expect(isUnder('apps/web/src/docs/tokens.ts', 'apps/web/src/docs/')).toBe(true);
    expect(isUnder('apps/web/src/docsite/x.ts', 'apps/web/src/docs/')).toBe(false);
  });

  it('reads any other entry as exactly one file', () => {
    expect(isUnder('apps/web/src/a/Theme.tsx', 'apps/web/src/a/Theme.tsx')).toBe(true);
    expect(isUnder('apps/web/src/a/MyTheme.tsx', 'apps/web/src/a/Theme.tsx')).toBe(false);
  });
});

describe('isExempt', () => {
  it('exempts only the app file a table names, never a look-alike elsewhere', () => {
    const tile = 'features/cards/components/CardTile.tsx';
    expect(isExempt(at(`/repo/apps/web/src/${tile}`), ADHOC_BUTTON_EXEMPT)).toBe(true);
    expect(isExempt(at(`/repo/packages/ui/src/${tile}`), ADHOC_BUTTON_EXEMPT)).toBe(false);
    expect(isExempt(at(`/work/inkweave-admin/src/${tile}`), ADHOC_BUTTON_EXEMPT)).toBe(false);
  });

  it("exempts a test or a story by its kind anywhere, as admin's lint relies on", () => {
    const admin = '/work/inkweave-admin/src';
    expect(isExempt(at(`${admin}/theme/__tests__/adminTheme.test.ts`), COLOR_EXEMPT)).toBe(true);
    expect(isExempt(at(`${admin}/ui/Primitives.stories.tsx`), SPACING_EXEMPT)).toBe(true);
  });
});

describe('exemption tables and the ledger', () => {
  it.each(TABLES.flatMap(([table, {paths}]) => paths.map((entry) => [table, entry])))(
    '%s names %s, which is in the repo',
    (_table, entry) => {
      expect(entry).toMatch(/^(apps\/web|packages\/ui)\//);
      expect(existsSync(REPO + entry)).toBe(true);
      expect(statSync(REPO + entry).isDirectory()).toBe(entry.endsWith('/'));
    },
  );

  it.each(LEDGER)('the %s ledger names %s, a file in the repo', (_rule, file) => {
    expect(file).toMatch(/^(apps\/web|packages\/ui)\//);
    expect(statSync(REPO + file, {throwIfNoEntry: false})?.isFile()).toBe(true);
  });
});
