/**
 * Whether a button is off: `disabled`, or `aria-disabled`, which keeps it focusable
 * (WAI-ARIA APG) where a native `disabled` would drop the focus it holds to the page.
 * Either way it looks off and the pointer does nothing to it; what a click does stays
 * the caller's, so `aria-disabled` alone still delivers one (#790). Shared by CtaButton
 * and LinkButton.
 */
export function isOff(
  disabled: boolean | undefined,
  ariaDisabled: React.AriaAttributes['aria-disabled'],
): boolean {
  return disabled === true || ariaDisabled === true || ariaDisabled === 'true';
}
