/**
 * A binder's name, held to `collection_binders_name`: 1 to 30 letters, no control character or
 * line break, and neither end blank. With these guards a save never meets that check, so the
 * only refusal an insert can meet is the shelf's cap.
 */

/** The most letters a name holds, counted as the check's `char_length` counts them: in code points. */
export const BINDER_NAME_MAX = 30;

/**
 * What the check refuses at either end: every space `String.prototype.trim` strips, and the
 * zero-width characters, so no name looks empty or starts with a gap.
 */
const BLANK_ENDS = /^[\s\u200b-\u200d\u2060]+|[\s\u200b-\u200d\u2060]+$/g;

/** What the check refuses anywhere: a control character or a line break. */
// eslint-disable-next-line no-control-regex -- the control characters are exactly what it finds
const CONTROL = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/;

/**
 * A name cut to 30 letters, for the field as the player types. `maxLength` counts UTF-16 units,
 * so it would cut a name of emoji short, as `clampDisplayName` explains.
 */
export function clampBinderName(name: string): string {
  const letters = [...name];
  return letters.length <= BINDER_NAME_MAX ? name : letters.slice(0, BINDER_NAME_MAX).join('');
}

/** A name as it is saved: the blanks at either end taken off, and any inside kept. */
export const trimBinderName = (name: string) => name.replace(BLANK_ENDS, '');

/** Whether the table takes the name once it is trimmed. */
export function isValidBinderName(name: string): boolean {
  const trimmed = trimBinderName(name);
  const letters = [...trimmed].length;
  return letters >= 1 && letters <= BINDER_NAME_MAX && !CONTROL.test(trimmed);
}
