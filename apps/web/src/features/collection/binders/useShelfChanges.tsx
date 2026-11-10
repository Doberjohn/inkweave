import {Suspense} from 'react';
import {lazyWithRetry} from '../../../shared/lib/lazyWithRetry';
import type {Binder} from './binderRules';
import {RenameBinderDialog} from './RenameBinderDialog';
import {useOpening} from './useOpening';

const CoverPicker = lazyWithRetry(() => import('./CoverPicker'), 'CoverPicker');

interface ChangesFor {
  /** Whose shelf: each change waits in their write queue. */
  readerId: string;
  isMobile: boolean;
  /** The covers are counted: false while the cards, the account's copy or the binders load. */
  counted: boolean;
  /** My collection's cover as the shelf holds it. */
  myCover: string | null;
}

/**
 * Rename and Change cover from a cover's ⋯: each dialog's opening, kept while it closes so its
 * words stay, and its element. Rename is small and comes with the shelf; Change cover loads in a
 * chunk of its own on its first opening. Each returns focus to the ⋯ that opened it as it closes.
 */
export function useShelfChanges({readerId, isMobile, counted, myCover}: ChangesFor) {
  const renames = useOpening<{binder: Binder}>();
  const covers = useOpening<{binder: Binder | null}>();
  const renaming = renames.opening;
  const picking = covers.opening;
  // The covers went to shimmers (the cards went, or the shelf waits on the account again), and
  // the ⋯ that opened the picker with them, so it goes too: kept, it would open again by itself
  // once they are back.
  if (!counted && picking !== null) covers.drop();
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
  const cover = picking && counted && (
    <Suspense fallback={null}>
      <CoverPicker
        key={picking.key}
        isOpen={picking.open}
        binder={picking.binder}
        myCover={myCover}
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
