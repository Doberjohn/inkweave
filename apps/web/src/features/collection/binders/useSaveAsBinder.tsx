import {Suspense, useEffect, useState, type ReactNode} from 'react';
import {useResponsive} from '../../../shared/hooks';
import type {FilterDraft} from '../../../shared/hooks/useFilterParams';
import {lazyWithRetry} from '../../../shared/lib/lazyWithRetry';
import type {OwnBinders, SaveOffer} from './binderChoices';
import type {Binder} from './binderRules';
import {focusSetPicker} from './focusSetPicker';
import {SaveAsBinderFoot} from './SaveAsBinderFoot';
import type {BinderWindowSlot} from './useBinderWindow';
import {useOpening} from './useOpening';

const SaveAsBinder = lazyWithRetry(() => import('./SaveAsBinder'), 'SaveAsBinder');

/** What Save as a binder needs of the page. */
export interface SaveFor {
  /**
   * The signed-in reader with a collection, in a binder of their own or My collection (never a
   * friend's, never the shelf): whose shelf the binder goes on. Null offers nothing.
   */
  readerId: string | null;
  /** What the page's filters make (`OwnBinders['offerOf']`), null while there is no room or no binder to join. */
  offerOf: OwnBinders['offerOf'];
  /** The set the picker has picked: the new binder's Sets. */
  scope: string;
  /** The New binder window's opening, for More rules; null until it can open. */
  openWindow: BinderWindowSlot['open'];
  /** Opens a binder of your own in place (`openBinderParams`, a replace). */
  openBinder: (binder: Binder) => void;
}

/** Save as a binder for the page: the foot each filter surface draws, and the box. */
export interface SaveSlot {
  /**
   * The foot for these filters and search, or null while they make no offer. `before` runs first
   * on a press: a tablet's or a phone's sheet applies its draft and closes.
   */
  render: (draft: FilterDraft, query: string, before?: () => void) => ReactNode;
  node: ReactNode;
}

/**
 * Hands focus to the set picker's button, which names the binder just opened, in an effect: after
 * the box's own close has put focus back where it was, on a foot the cleared filters take away.
 */
function useFocusPickerAfter() {
  const [asked, setAsked] = useState(0);
  useEffect(() => {
    if (asked > 0) focusSetPicker();
  }, [asked]);
  return () => setAsked((n) => n + 1);
}

/**
 * Save as a binder's place on the page: the foot under the filters, offered only while
 * the page's filters and search make a binder (`saveOffer`), and the box it opens. A binder made
 * in the box, or in the window its More rules opens, opens in place, so the cards stay on screen
 * with the filter panel clear, and focus goes to the set picker's button.
 *
 * Code outside this folder takes it through a choice on the flag itself (`flag.ts`).
 */
export function useSaveAsBinder({readerId, offerOf, scope, openWindow, openBinder}: SaveFor): SaveSlot {
  const {isMobile} = useResponsive();
  const {opening, drop, open, close, forget} = useOpening<{offer: SaveOffer}>();
  const focusPicker = useFocusPickerAfter();
  if (readerId === null) {
    // Signed out, or no longer where a binder can be saved: an open box goes, never to come back by itself.
    if (opening !== null) drop();
    return {render: () => null, node: null};
  }
  const opened = (binder: Binder) => {
    openBinder(binder);
    focusPicker();
  };
  const render = (draft: FilterDraft, query: string, before?: () => void) => {
    const offer = offerOf?.({draft, query, scope}) ?? null;
    if (offer === null) return null;
    const press = () => {
      before?.();
      open({offer});
    };
    return <SaveAsBinderFoot offer={offer} onPress={press} />;
  };
  const node = opening && (
    <Suspense fallback={null}>
      <SaveAsBinder
        key={opening.key}
        isOpen={opening.open}
        offer={opening.offer}
        readerId={readerId}
        isMobile={isMobile}
        onSaved={(binder) => {
          close();
          opened(binder);
        }}
        onMoreRules={(seed) => {
          close();
          openWindow?.({binder: null, seed, onSaved: opened});
        }}
        onClose={close}
        onGone={() => forget(opening.key)}
      />
    </Suspense>
  );
  return {render, node};
}
