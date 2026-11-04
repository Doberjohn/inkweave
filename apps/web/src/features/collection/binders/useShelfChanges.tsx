import {Suspense} from 'react';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {lazyWithRetry} from '../../../shared/lib/lazyWithRetry';
import type {CollectionEntries} from '../collectionParser';
import type {Binder} from './binderRules';
import {RenameBinderDialog} from './RenameBinderDialog';
import {useOpening} from './useOpening';

const CoverPicker = lazyWithRetry(() => import('./CoverPicker'), 'CoverPicker');

interface ChangesFor {
  /** Whose shelf: each change waits in their write queue. */
  readerId: string;
  isMobile: boolean;
  /** The cards the covers are counted over, null until they are: Change cover offers from them. */
  pool: readonly LorcanaCard[] | null;
  entries: CollectionEntries;
  /** My collection's cover as the shelf holds it. */
  shelfCover: string | null;
}

/**
 * Rename and Change cover from a cover's ⋯: each dialog's opening, kept while it closes so its
 * words stay, and its element. Rename is small and comes with the shelf; Change cover loads in a
 * chunk of its own on its first opening. Each returns focus to the ⋯ that opened it as it closes.
 */
export function useShelfChanges({readerId, isMobile, pool, entries, shelfCover}: ChangesFor) {
  const renames = useOpening<{binder: Binder}>();
  const covers = useOpening<{binder: Binder | null}>();
  const renaming = renames.opening;
  const picking = covers.opening;
  // The picker unmounts here without its close (the cards went, or the shelf waits on the account
  // again), so its opening goes too: kept, it would open again by itself once they are back.
  if (pool === null && picking !== null) covers.drop();
  const rename = renaming && (
    <RenameBinderDialog
      key={renaming.key}
      isOpen={renaming.open}
      binder={renaming.binder}
      readerId={readerId}
      isMobile={isMobile}
      onSaved={renames.close}
      onClose={renames.close}
      onGone={() => renames.forget(renaming.key)}
    />
  );
  const cover = picking && pool !== null && (
    <Suspense fallback={null}>
      <CoverPicker
        key={picking.key}
        isOpen={picking.open}
        binder={picking.binder}
        shelfCover={shelfCover}
        pool={pool}
        entries={entries}
        readerId={readerId}
        isMobile={isMobile}
        onSaved={covers.close}
        onClose={covers.close}
        onGone={() => covers.forget(picking.key)}
      />
    </Suspense>
  );
  return {
    rename: (binder: Binder) => renames.open({binder}),
    changeCover: (binder: Binder | null) => covers.open({binder}),
    node: (
      <>
        {rename}
        {cover}
      </>
    ),
  };
}
