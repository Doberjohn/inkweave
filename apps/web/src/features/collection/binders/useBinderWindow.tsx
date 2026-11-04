import {Suspense, type ReactNode} from 'react';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {useResponsive} from '../../../shared/hooks';
import {lazyWithRetry} from '../../../shared/lib/lazyWithRetry';
import type {CollectionEntries} from '../collectionParser';
import type {Binder} from './binderRules';
import type {NewStart} from './useBinderDraft';
import {useOpening} from './useOpening';

const BinderWindow = lazyWithRetry(() => import('./BinderWindow'), 'BinderWindow');

/** What opens the window: the binder Edit rules changes, or null for a new one, and what follows a save. */
export interface WindowAsk {
  binder: Binder | null;
  /** A new binder's name, Sets and rules to start from: Save as a binder's More rules. */
  seed?: NewStart;
  /** Told once the server has the binder, as the window closes: where focus or the page goes next. */
  onSaved: (binder: Binder) => void;
}

/** The window for the page: what opens it, null until the reader and the cards are in, and its element. */
export interface BinderWindowSlot {
  open: ((ask: WindowAsk) => void) | null;
  node: ReactNode;
}

interface WindowFor {
  /** The signed-in reader, whose shelf the window saves to. */
  readerId: string | null;
  /** Every card a binder can hold, null while it loads. */
  pool: readonly LorcanaCard[] | null;
  entries: CollectionEntries;
}

/**
 * The New binder window's one place on the page, which the shelf's New binder and Edit
 * rules and the Binders tab's New binder all open, each saying what follows a save. Opened only
 * once the cards are in, so its count never waits. The window loads in a chunk of its own on
 * the first opening.
 *
 * Code outside this folder takes it through a choice on the flag itself (`flag.ts`).
 */
export function useBinderWindow({readerId, pool, entries}: WindowFor): BinderWindowSlot {
  const {isMobile} = useResponsive();
  const {opening, drop, open, close, forget} = useOpening<WindowAsk>();
  if (readerId === null || pool === null) {
    // The window unmounts here (collection mode ended, or the reader signed out) without its
    // close, so its opening goes too: kept, it would open again by itself once both are back.
    if (opening !== null) drop();
    return {open: null, node: null};
  }
  const node = opening && (
    <Suspense fallback={null}>
      <BinderWindow
        key={opening.key}
        isOpen={opening.open}
        binder={opening.binder}
        seed={opening.seed}
        pool={pool}
        entries={entries}
        readerId={readerId}
        isMobile={isMobile}
        onSaved={(binder) => {
          close();
          opening.onSaved(binder);
        }}
        onClose={close}
        onGone={() => forget(opening.key)}
      />
    </Suspense>
  );
  return {open, node};
}
