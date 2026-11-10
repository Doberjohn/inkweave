import type {LorcanaCard} from 'inkweave-synergy-engine';
import type {FilterDraft} from '../../../shared/hooks/useFilterParams';
import type {CollectionEntries} from '../collectionParser';
import type {BinderFigures} from './binderCovers';
import type {Binder} from './binderRules';
import type {CoverDesign} from './coverDesigns';
import type {BinderReader, BinderShelf} from './binderShelf';

/*
 * Types alone: code outside this folder imports them with `import type`, which loads nothing, so
 * it names binders without breaking "off means not loaded" (`flag.ts`).
 */

/** A binder of the reader's own on show, as the page holds it. */
export interface OpenBinder {
  binder: Binder;
  /** Its cover's design, which its medal shows. */
  cover: CoverDesign;
  /** Its rules hold a filter, so it packs its cards as a filtered binder does (`binderSlots`). */
  narrowed: boolean;
}

/** What the set picker, the set panel and the binder know of the reader's binders, outside a friend's binder. */
export interface BinderChoices {
  /** The binder of your own on show, or null for My collection. */
  open: OpenBinder | null;
  /** It shows at its own Sets, not a set picked inside it. */
  atOwnScope: boolean;
  /** Your binders in shelf order, and whether they have loaded. */
  shelf: BinderShelf;
  /** What the Binders tab counts and covers each binder from: the whole pool, null while it loads. */
  pool: readonly LorcanaCard[] | null;
  /** Your copies. */
  entries: CollectionEntries;
  /** Opens a binder of your own, or My collection (null), from the Binders tab. */
  onOpen: (binder: Binder | null) => void;
  /** Opens the shelf, every binder at once: the Binders tab's All your binders. */
  onShelf: () => void;
  /** Opens the New binder window, whose binder then opens; null until the cards are in. */
  onNewBinder: (() => void) | null;
}

/**
 * The binder `?custom=` names: none asked, the shelf still to answer, on show, not on the reader's
 * shelf, or a shelf that failed to load, with its Try again.
 */
export type CustomBinder =
  | {status: 'none' | 'loading' | 'unknown'}
  | {status: 'failed'; retry: () => void}
  | ({status: 'shown'} & OpenBinder);

/** What the page asks for: whose binders, and which one `?custom=` names. */
export interface OwnBindersAsk extends BinderReader {
  /** The id `?custom=` names, or null; never asked in a friend's binder. */
  requested: string | null;
}

/** The reader's binders as the page uses them (`useOwnBinders`). */
export interface OwnBinders {
  /** Their shelf, for the set picker's Binders tab; null where binders are off. */
  shelf: BinderShelf | null;
  custom: CustomBinder;
  /** The cards the binder on show holds: a binder of your own's (`rulePool`), else the whole pool. */
  pool: LorcanaCard[];
  /**
   * What Save as a binder makes of the page's filters and search at the set picked (`saveOffer`),
   * once the shelf has loaded with room on it, in My collection or a binder of your own on show;
   * else null.
   */
  offerOf: ((page: OfferAsk) => SaveOffer | null) | null;
}

/** The page Save as a binder reads: its filters, its search, and the set picked. */
export interface OfferAsk {
  draft: FilterDraft;
  query: string;
  scope: string;
}

/** A binder Save as a binder would make: its Sets and rules, its line ("Amber ink · Epic") and its numbers. */
export interface SaveOffer {
  scope: string;
  rules: string;
  line: string;
  figures: BinderFigures;
}
