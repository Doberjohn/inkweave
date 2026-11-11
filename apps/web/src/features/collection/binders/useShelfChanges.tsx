import {Suspense} from 'react';
import {lazyWithRetry} from '../../../shared/lib/lazyWithRetry';
import type {PageSide} from '../../cards/components/binderGeometry';
import type {Binder} from './binderRules';
import {RenameBinderDialog} from './RenameBinderDialog';
import {useOpening} from './useOpening';

const CoverPicker = lazyWithRetry(() => import('./CoverPicker'), 'CoverPicker');
const PagesPicker = lazyWithRetry(() => import('./PagesPicker'), 'PagesPicker');

interface ChangesFor {
  /** Whose shelf: each change waits in their write queue. */
  readerId: string;
  isMobile: boolean;
  /** The covers are counted: false while the cards, the account's copy or the binders load. */
  counted: boolean;
  /** My collection's cover as the shelf holds it. */
  myCover: string | null;
  /** My collection's page as the shelf holds it. */
  myPages: PageSide;
}

type PickerFor = Pick<ChangesFor, 'readerId' | 'isMobile' | 'counted'>;

/**
 * A picker's opening that goes with the covers: when they go to shimmers (the cards went, or the
 * shelf waits on the account again), the ⋯ that opened it goes with them, so it goes too. Kept,
 * it would open again by itself once they are back.
 */
function usePickerOpening<Ask extends object>(counted: boolean) {
  const opening = useOpening<Ask>();
  if (!counted && opening.opening !== null) opening.drop();
  return opening;
}

/** Change cover, on a binder or on My collection (null). */
function useCoverChange({readerId, isMobile, counted, myCover}: PickerFor & Pick<ChangesFor, 'myCover'>) {
  const covers = usePickerOpening<{binder: Binder | null}>(counted);
  const picking = covers.opening;
  const node = picking && counted && (
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
  return {open: (binder: Binder | null) => covers.open({binder}), node};
}

/** Pages, My collection's page size, its alone. */
function usePagesChange({readerId, isMobile, counted, myPages}: PickerFor & Pick<ChangesFor, 'myPages'>) {
  const sizes = usePickerOpening<object>(counted);
  const sizing = sizes.opening;
  const node = sizing && counted && (
    <Suspense fallback={null}>
      <PagesPicker
        key={sizing.key}
        isOpen={sizing.open}
        pages={myPages}
        readerId={readerId}
        isMobile={isMobile}
        onSaved={sizes.close}
        onClose={sizes.close}
        onGone={() => sizes.forget(sizing.key)}
      />
    </Suspense>
  );
  return {open: () => sizes.open({}), node};
}

/**
 * Rename, Change cover and My collection's Pages from a cover's ⋯: each dialog's
 * opening, kept while it closes so its words stay, and its element. Rename is small and comes
 * with the shelf; the two pickers each load in a chunk of their own on their first opening. Each
 * returns focus to the ⋯ that opened it as it closes.
 */
export function useShelfChanges(changes: ChangesFor) {
  const {readerId, isMobile} = changes;
  const renames = useOpening<{binder: Binder}>();
  const covers = useCoverChange(changes);
  const sizes = usePagesChange(changes);
  const renaming = renames.opening;
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
  return {
    rename: (binder: Binder) => renames.open({binder}),
    changeCover: covers.open,
    changePages: sizes.open,
    node: (
      <>
        {rename}
        {covers.node}
        {sizes.node}
      </>
    ),
  };
}
