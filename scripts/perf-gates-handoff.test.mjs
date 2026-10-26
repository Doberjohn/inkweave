// perf-gates.yml runs Prerender Handoff only on a pull request that touches a path its `handoff`
// filter lists (#915). A listed path that names no file never starts the job, so a module that
// moves (#980) stops guarding the handoff without a word. This holds each path to a file.
import {describe, expect, it} from 'vitest';
import {existsSync, readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const WORKFLOW = readFileSync(join(ROOT, '.github', 'workflows', 'perf-gates.yml'), 'utf8');

/** The `- '<path>'` lines right under the filter's `handoff:` key, up to the first other line. */
function handoffPaths(text) {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((line) => /^\s+handoff:\s*$/.test(line));
  const paths = [];
  for (const line of lines.slice(start + 1)) {
    const match = /^\s+- '([^']+)'\s*$/.exec(line);
    if (!match) break;
    paths.push(match[1]);
  }
  return paths;
}

const PATHS = handoffPaths(WORKFLOW);
const isGlob = (path) => /[*?[{]/.test(path);

describe("perf-gates.yml's handoff filter", () => {
  it('reads the paths under handoff:', () => {
    expect(PATHS.length).toBeGreaterThan(30);
  });

  it.each(PATHS.filter((path) => !isGlob(path)))('names a file: %s', (path) => {
    expect(existsSync(join(ROOT, path))).toBe(true);
  });
});
