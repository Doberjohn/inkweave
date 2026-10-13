import {describe, expect, it} from 'vitest';
import {monthTitle, releaseNotesProblems} from '../validateNotes';

type Notes = Record<string, unknown> & {sections: Record<string, Record<string, unknown>[]>};

/** A small month that passes every rule; each case below breaks one. */
function validMonth(): Notes {
  return {
    schemaVersion: 1,
    month: '2026-10',
    title: 'October 2026',
    summary: 'Set 14 lands, with a faster card page.',
    sections: {
      new: [
        {
          title: 'Set 14 is out',
          body: 'Every Set 14 card now has its synergies.',
          highlight: true,
          link: {label: 'Browse the cards', to: '/browse'},
          prs: [801, 802],
        },
      ],
      fixed: [{title: 'Card search', body: 'Search finds franchise names again.'}],
    },
    behindTheScenes: 'Plus 12 behind-the-scenes changes.',
  };
}

describe('releaseNotesProblems', () => {
  it('passes a valid month', () => {
    expect(releaseNotesProblems(validMonth())).toEqual([]);
  });

  it('rejects anything but one JSON object', () => {
    expect(releaseNotesProblems([])).toEqual(['the file must hold one JSON object']);
  });

  it.each([
    {
      broken: 'a missing summary',
      change: (notes: Notes) => delete notes.summary,
      problem: 'summary: must be non-empty text',
    },
    {
      broken: 'a title that names another month',
      change: (notes: Notes) => (notes.title = 'September 2026'),
      problem: 'title: should be "October 2026" for 2026-10',
    },
    {
      broken: 'Markdown in a body',
      change: (notes: Notes) => (notes.sections.new[0].body = 'Now **bold**.'),
      problem: 'sections.new[0].body: contains Markdown emphasis or code',
    },
    {
      broken: 'a PR reference in a body',
      change: (notes: Notes) => (notes.sections.fixed[0].body = 'Fixed in #616.'),
      problem: 'sections.fixed[0].body: contains a PR or issue reference (PR numbers go in prs)',
    },
    {
      broken: 'an empty section',
      change: (notes: Notes) => (notes.sections.improved = []),
      problem: 'sections.improved: must be a non-empty list (leave the section out instead)',
    },
    {
      broken: 'an unknown section',
      change: (notes: Notes) => (notes.sections.misc = notes.sections.fixed),
      problem: 'sections: unknown key "misc"',
    },
    {
      broken: 'a link off the site',
      change: (notes: Notes) => (notes.sections.new[0].link = {label: 'News', to: 'https://x.y'}),
      problem: 'sections.new[0].link.to: must be an in-app path starting with a single /',
    },
    {
      broken: 'a PR listed twice',
      change: (notes: Notes) => (notes.sections.new[0].prs = [801, 801]),
      problem: 'sections.new[0].prs: lists a PR twice',
    },
    {
      broken: 'no highlight',
      change: (notes: Notes) => delete notes.sections.new[0].highlight,
      problem: 'highlights: 0 items are marked, mark 1 to 5',
    },
  ])('names $broken', ({change, problem}) => {
    const notes = validMonth();
    change(notes);
    expect(releaseNotesProblems(notes)).toEqual([problem]);
  });
});

describe('monthTitle', () => {
  it('names the month and year', () => {
    expect(monthTitle('2026-01')).toBe('January 2026');
  });
});
