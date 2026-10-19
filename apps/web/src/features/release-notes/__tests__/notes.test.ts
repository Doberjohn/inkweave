import {describe, expect, it} from 'vitest';
import {RELEASE_NOTES} from '../notes';
import {releaseNotesProblems} from '../validateNotes';

// Every notes file, keyed by its path, read once at module scope (tests.md).
const FILES = Object.entries(
  import.meta.glob<unknown>('../notes/*.json', {eager: true, import: 'default'}),
);

describe('release notes files', () => {
  it('finds at least one week', () => {
    expect(FILES.length).toBeGreaterThan(0);
  });

  it.each(FILES)('%s follows the format', (_path, notes) => {
    expect(releaseNotesProblems(notes)).toEqual([]);
  });

  it.each(FILES)('%s is named for the week it covers', (path, notes) => {
    expect(path).toBe(`../notes/${(notes as {week?: unknown}).week}.json`);
  });

  it('lists every file once, newest week first', () => {
    const fileWeeks = FILES.map(([path]) => path.replace(/^.*\/(.+)\.json$/, '$1'));
    expect(RELEASE_NOTES.map((notes) => notes.week)).toEqual(fileWeeks.sort().reverse());
  });
});
