import type {PlaystyleId} from 'inkweave-synergy-engine';

/**
 * A playstyle page's written guide (#995), from `/data/playstyleGuides.json`: text of the page's
 * own for search, under its card grid, and its key cards as links to their card pages.
 */
export interface PlaystyleGuide {
  /** What the deck does and how it wins, then how to build it. */
  paragraphs: string[];
  /** The cards to start from, by id, in the order the page lists them. */
  keyCards: string[];
}

/** The fetched file's shape. Partial: the data test, not the type, proves every playstyle has one. */
export type PlaystyleGuides = Partial<Record<PlaystyleId, PlaystyleGuide>>;
