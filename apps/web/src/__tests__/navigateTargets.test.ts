import {describe, it, expect} from 'vitest';
import {readFileSync, readdirSync} from 'node:fs';
import {join, resolve} from 'node:path';

/**
 * Every literal `navigate('/…')` target must match a route the router declares.
 *
 * Written after `AuthCallbackPage` shipped `navigate('/decks')` into a tree with no
 * `/decks` route, so a completed OAuth sign-in landed on the 404 page. Nothing caught
 * it: it type-checks, it lints, and no unit test renders that page. The split into
 * sequential PRs makes this a recurring hazard rather than a one-off, because a page
 * can arrive in one PR while the route it points at waits for a later one.
 *
 * Deliberately a SOURCE scan, not a render. Importing `router.tsx` pulls in every lazy
 * page and the whole provider stack to assert one thing about strings.
 *
 * The catch-all is excluded on purpose. `*` matches everything, so counting it as a
 * match is exactly the bug: it is what silently absorbed `/decks`.
 */

const SRC = resolve(__dirname, '..');

function tsxFiles(dir: string): string[] {
  return readdirSync(dir, {withFileTypes: true}).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : tsxFiles(full);
    return entry.name.endsWith('.tsx') && !entry.name.includes('.test.') ? [full] : [];
  });
}

/** Declared paths from router.tsx, as full paths anchored at the root route. */
function declaredRoutes(): string[] {
  const source = readFileSync(join(SRC, 'router.tsx'), 'utf8');
  const paths = [...source.matchAll(/^\s*path: '([^']+)',/gm)].map((m) => m[1]);
  return paths
    .filter((p) => p !== '*')
    .map((p) => (p.startsWith('/') ? p : `/${p}`));
}

/** Literal navigate targets. Template literals are skipped: they are not decidable here. */
function navigateTargets(): {file: string; target: string}[] {
  return tsxFiles(SRC).flatMap((file) =>
    [...readFileSync(file, 'utf8').matchAll(/navigate\('(\/[^']*)'/g)].map((m) => ({
      file: file.slice(SRC.length + 1).replace(/\\/g, '/'),
      target: m[1],
    })),
  );
}

/** A declared path matches a target when every segment matches, `:param` taking any one. */
function matches(declared: string, target: string): boolean {
  const d = declared.split('/');
  const t = target.split('/');
  return d.length === t.length && d.every((seg, i) => seg.startsWith(':') || seg === t[i]);
}

describe('navigate targets', () => {
  it('finds the route table and the call sites, so the check is not vacuous', () => {
    expect(declaredRoutes().length).toBeGreaterThan(5);
    expect(navigateTargets().length).toBeGreaterThan(0);
  });

  it('every literal navigate target resolves to a declared route', () => {
    const routes = declaredRoutes();
    const dangling = navigateTargets()
      .filter(({target}) => !routes.some((r) => matches(r, target)))
      .map(({file, target}) => `${file} -> ${target}`);

    expect(dangling).toEqual([]);
  });
});
