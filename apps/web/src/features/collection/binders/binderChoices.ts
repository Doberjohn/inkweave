import type {LorcanaCard} from 'inkweave-synergy-engine';
import type {CollectionEntries} from '../collectionParser';
import type {Binder} from './binderRules';
import type {BinderReader, BinderShelf} from './binderShelf';

/*
 * Types alone: code outside this folder imports them with `import type`, which loads nothing, so
 * it names binders without breaking "off means not loaded" (`flag.ts`).
 */

/** A binder of the reader's own on show, as the page holds it. */
export interface OpenBinder {
  binder: Binder;
  /** The card on its cover (`coverOf`), or none while it holds none of yours. */
  cover: LorcanaCard | null;
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
}
