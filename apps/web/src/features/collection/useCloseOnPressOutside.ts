import {useEffect, type RefObject} from 'react';

/**
 * Close a popup on a press anywhere outside its wrapper (`ref`): the set picker's menu, and
 * the collection actions' menu. A press, not a blur: a click doesn't focus a button in
 * Safari, so a blur there can't tell a press outside from a pick.
 */
export function useCloseOnPressOutside(
  open: boolean,
  ref: RefObject<HTMLElement | null>,
  setOpen: (open: boolean) => void,
) {
  useEffect(() => {
    if (!open) return;
    const onPress = (e: PointerEvent) => {
      if (!(e.target instanceof Node && ref.current?.contains(e.target))) setOpen(false);
    };
    document.addEventListener('pointerdown', onPress);
    return () => document.removeEventListener('pointerdown', onPress);
  }, [open, ref, setOpen]);
}
