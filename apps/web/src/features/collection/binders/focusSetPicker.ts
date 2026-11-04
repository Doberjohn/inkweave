/**
 * Focuses the set picker's button (it carries `data-set-picker`), if the page draws one: a binder
 * made elsewhere on the page, by Save as a binder, hands focus to the button that now names it. A
 * module of its own, since the picker loads with the binder and what calls this loads before it.
 */
export function focusSetPicker(): void {
  document.querySelector<HTMLElement>('[data-set-picker]')?.focus();
}
