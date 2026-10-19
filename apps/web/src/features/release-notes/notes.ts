import type {ReleaseNotesWeek} from './types';

// Every file in ./notes, read at build time. Vite inlines them into this module, which only the
// lazy release notes page imports, so the notes stay out of the homepage's entry chunk.
const files = import.meta.glob<ReleaseNotesWeek>('./notes/*.json', {
  eager: true,
  import: 'default',
});

/** Every week's notes, newest first. Publishing a week means adding notes/<YYYY-MM-DD>.json. */
export const RELEASE_NOTES: ReleaseNotesWeek[] = Object.values(files).sort((a, b) =>
  b.week.localeCompare(a.week),
);
