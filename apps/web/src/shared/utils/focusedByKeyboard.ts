/**
 * Whether an element's focus came from the keyboard (`:focus-visible`), for a control that shows
 * on keyboard focus what it shows under a pointer: a click's focus leaves that to the hover. A
 * browser that cannot say counts any focus.
 */
export function focusedByKeyboard(el: Element): boolean {
  try {
    return el.matches(':focus-visible');
  } catch {
    return true;
  }
}
