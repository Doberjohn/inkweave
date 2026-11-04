import {Suspense, useState, type ReactNode} from 'react';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {useResponsive} from '../../../shared/hooks';
import {lazyWithRetry} from '../../../shared/lib/lazyWithRetry';
import type {CollectionEntries} from '../collectionParser';
import type {Binder} from './binderRules';

const BinderWindow = lazyWithRetry(() => import('./BinderWindow'), 'BinderWindow');

/** What opens the window: the binder Edit rules changes, or null for a new one, and what follows a save. */
export interface WindowAsk {
  binder: Binder | null;
  /** Told once the server has the binder, as the window closes: where focus or the page goes next. */
  onSaved: (binder: Binder) => void;
}

/** The window's opening, kept while it closes so its words stay through the exit. */
interface Opening extends WindowAsk {
  open: boolean;
  /** Each opening mounts the window afresh, so it starts from its binder, never the last draft. */
  key: number;
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
 * The New binder window's one place on the page (#1075), which the shelf's New binder and Edit
 * rules and the Binders tab's New binder all open, each saying what follows a save. Opened only
 * once the cards are in, so its count never waits. The window loads in a chunk of its own on
 * the first opening.
 *
 * Code outside this folder takes it through a choice on the flag itself (`flag.ts`).
 */
export function useBinderWindow({readerId, pool, entries}: WindowFor): BinderWindowSlot {
  const {isMobile} = useResponsive();
  const [opening, setOpening] = useState<Opening | null>(null);
  if (readerId === null || pool === null) return {open: null, node: null};
  const open = (ask: WindowAsk) => setOpening((now) => ({...ask, open: true, key: (now?.key ?? 0) + 1}));
  const close = () => setOpening((now) => now && {...now, open: false});
  const node = opening && (
    <Suspense fallback={null}>
      <BinderWindow
        key={opening.key}
        isOpen={opening.open}
        binder={opening.binder}
        pool={pool}
        entries={entries}
        readerId={readerId}
        isMobile={isMobile}
        onSaved={(binder) => {
          close();
          opening.onSaved(binder);
        }}
        onClose={close}
      />
    </Suspense>
  );
  return {open, node};
}
