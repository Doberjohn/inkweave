// The weekly release notes format. One JSON file per week lives in ./notes, named for the Monday
// the week starts (<YYYY-MM-DD>.json, in UTC). The project's Weekly changelog draft routine writes
// each week's file and publishes it with a PR that adds the file; validateNotes.ts holds the rules
// every file must pass. The page started out monthly (#765), as schemaVersion 1.

/** The sections a week can have, in the order the page shows them. */
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
  /** One of the week's headline items. A week marks up to five, and a quiet one none. */
  highlight?: boolean;
  link?: ReleaseNoteLink;
  /** The Doberjohn/inkweave PRs behind the item. Kept for the record; the page doesn't show them. */
  prs?: number[];
}

export interface ReleaseNotesWeek {
  schemaVersion: 2;
  /** The week's Monday, "YYYY-MM-DD": also the file name and the week's anchor on the page. */
  week: string;
  /** The week's heading, Monday to Sunday, such as "September 28 to October 4, 2026". */
  title: string;
  /** One line under the heading, up to 280 characters. */
  summary: string;
  /** Only the sections that have items: an empty section is left out, never an empty list. */
  sections: Partial<Record<ReleaseNotesSectionKey, ReleaseNoteItem[]>>;
  /** One closing line for dependency, CI, tooling, test and docs changes. */
  behindTheScenes?: string;
}
