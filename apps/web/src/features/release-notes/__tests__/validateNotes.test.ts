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
      broken: 'a PR reference right after a word',
      change: (notes: Notes) => (notes.sections.fixed[0].body = 'Fixed in PR#616.'),
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
      problem:
        'sections.new[0].link.to: must be an in-app path (one leading /, no spaces or backslashes)',
    },
    {
      broken: 'a backslash in a link',
      change: (notes: Notes) => (notes.sections.new[0].link = {label: 'News', to: '/\\x.y'}),
      problem:
        'sections.new[0].link.to: must be an in-app path (one leading /, no spaces or backslashes)',
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

  it('reads a single * or _ around text as emphasis, but not one between words', () => {
    const problemsIn = (body: string) => {
      const notes = validMonth();
      notes.sections.fixed[0].body = body;
      return releaseNotesProblems(notes);
    };
    const emphasis = ['sections.fixed[0].body: contains Markdown emphasis or code'];
    expect(problemsIn('Now *really* fast.')).toEqual(emphasis);
    expect(problemsIn('Now _really_ fast.')).toEqual(emphasis);
    expect(problemsIn('Costs 2 * 3 ink, and snake_case_names stay.')).toEqual([]);
  });

  it('rejects a link to the Reveals page or under it, but not a path that only starts alike', () => {
    const problemsFor = (to: string) => {
      const notes = validMonth();
      notes.sections.new[0].link = {label: 'See the reveals', to};
      return releaseNotesProblems(notes);
    };
    const revealSeason = [
      'sections.new[0].link.to: links to a reveal-season page, which redirects home outside the season',
    ];
    expect(problemsFor('/reveals')).toEqual(revealSeason);
    expect(problemsFor('/Reveals/set-14?ink=amber')).toEqual(revealSeason);
    expect(problemsFor('/revealsx')).toEqual([]);
  });

  it('counts an emoji as one character, like the routine does', () => {
    const notes = validMonth();
    notes.sections.fixed[0].title = `${'a'.repeat(79)}🎉`;
    expect(releaseNotesProblems(notes)).toEqual([]);
    notes.sections.fixed[0].title += '!';
    expect(releaseNotesProblems(notes)).toEqual([
      'sections.fixed[0].title: 81 characters, the limit is 80',
    ]);
  });
});

describe('monthTitle', () => {
  it('names the month and year', () => {
    expect(monthTitle('2026-01')).toBe('January 2026');
  });
});
