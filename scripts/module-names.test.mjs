import {describe, it, expect} from 'vitest';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// Windows and macOS's default file system ignore case, so where two modules' names differ only by
// case, an import written without its extension finds whichever the resolver tries first: Vite
// tries `.ts` before `.tsx`, so `./BinderShelf` would load a `binderShelf.ts` beside it. Linux CI
// tells them apart, so only this check catches it.

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** What a resolver may add to an import written without one (Vite's `resolve.extensions`, plus CommonJS's). */
const RESOLVED = /\.(?:mjs|js|mts|ts|jsx|tsx|json|cjs|cts)$/;

/** Each set of module paths, extension dropped, that differ only by case: a group per clash. */
function caseClashes(files) {
  const spellings = new Map();
  for (const file of files) {
    if (!RESOLVED.test(file)) continue;
    const stem = file.replace(RESOLVED, '');
    const key = stem.toLowerCase();
    spellings.set(key, (spellings.get(key) ?? new Set()).add(stem));
  }
  return [...spellings.values()].filter((stems) => stems.size > 1).map((stems) => [...stems].sort());
}

const tracked = () => execFileSync('git', ['ls-files', '-z'], {cwd: ROOT, encoding: 'utf8'}).split('\0').filter(Boolean);

describe('module names', () => {
  it('finds two modules whose names differ only by case, whatever their extensions', () => {
    expect(caseClashes(['a/BinderShelf.tsx', 'a/binderShelf.ts', 'a/binderShelf.css'])).toEqual([
      ['a/BinderShelf', 'a/binderShelf'],
    ]);
  });

  it('finds them in folders that differ only by case too', () => {
    expect(caseClashes(['Cards/loader.ts', 'cards/loader.ts'])).toEqual([['Cards/loader', 'cards/loader']]);
  });

  it('passes names that differ by more than case, and files no import leaves its extension off', () => {
    expect(caseClashes(['a/BinderShelf.tsx', 'a/shelfStore.ts', 'a/binderShelf.css', 'a/Read.md', 'a/read.md'])).toEqual([]);
  });

  it('keeps every tracked module apart from the others on a file system that ignores case', () => {
    const files = tracked();
    expect(files.length).toBeGreaterThan(1000);
    expect(caseClashes(files)).toEqual([]);
  });
});
