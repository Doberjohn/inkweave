// The monthly release notes format (#765). One JSON file per month lives in ./notes, named
// <YYYY-MM>.json. The project's Monthly changelog draft routine writes each month's file and the
// owner publishes it with a PR that adds the file; validateNotes.ts holds the rules every file
// must pass.

/** The sections a month can have, in the order the page shows them. */
export const RELEASE_NOTES_SECTIONS = ['new', 'improved', 'fixed', 'engine'] as const;

export type ReleaseNotesSectionKey = (typeof RELEASE_NOTES_SECTIONS)[number];

/** Each section's heading on the page. */
export const SECTION_HEADINGS: Record<ReleaseNotesSectionKey, string> = {
  new: 'New',
  improved: 'Improved',
  fixed: 'Fixed',
  engine: 'Synergy engine',
};

export interface ReleaseNoteLink {
  label: string;
  /** An in-app path starting with a single "/". Never a reveal-season path, which goes away. */
  to: string;
}

export interface ReleaseNoteItem {
  /** Short lead, up to 80 characters. */
  title: string;
  /** One to three plain-text sentences, up to 600 characters. */
  body: string;
  /** One of the month's headline items. Each month marks one to five. */
  highlight?: boolean;
  link?: ReleaseNoteLink;
  /** The Doberjohn/inkweave PRs behind the item. Kept for the record; the page doesn't show them. */
  prs?: number[];
}

export interface ReleaseNotesMonth {
  schemaVersion: 1;
  /** The month covered, "YYYY-MM". Also the file name and the month's anchor on the page. */
  month: string;
  /** The month's heading, such as "September 2026". */
  title: string;
  /** One line under the heading, up to 280 characters. */
  summary: string;
  /** Only the sections that have items: an empty section is left out, never an empty list. */
  sections: Partial<Record<ReleaseNotesSectionKey, ReleaseNoteItem[]>>;
  /** One closing line for dependency, CI, tooling, test and docs changes. */
  behindTheScenes?: string;
}
