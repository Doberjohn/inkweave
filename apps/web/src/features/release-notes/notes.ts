import type {ReleaseNotesMonth} from './types';

// Every file in ./notes, read at build time. Vite inlines them into this module, which only the
// lazy release notes page imports, so the notes stay out of the homepage's entry chunk.
const files = import.meta.glob<ReleaseNotesMonth>('./notes/*.json', {
  eager: true,
  import: 'default',
});

/** Every month's notes, newest first. Publishing a month means adding notes/<YYYY-MM>.json. */
export const RELEASE_NOTES: ReleaseNotesMonth[] = Object.values(files).sort((a, b) =>
  b.month.localeCompare(a.month),
);
