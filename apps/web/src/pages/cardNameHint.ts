/** Words a card name keeps in lower case after its first ("Mickey Mouse - Leader of the Band"). */
const SMALL_WORDS = new Set([
  'a',
  'an',
  'and',
  'as',
  'at',
  'by',
  'for',
  'from',
  'in',
  'into',
  'is',
  'of',
  'on',
  'or',
  'the',
  'to',
  'up',
  'with',
]);

const capitalized = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

/**
 * The card name a card page's address spells (`cardPath`'s slug), near enough to wrap as the
 * name does while the card list loads (#914): the slug's words capitalized, small words in lower
 * case after the first, and the " - " between name and version after the first word, since the
 * slug keeps no trace of where it went. Set in the phone heading's type it takes the name's lines
 * for all but a few names. No slug, no hint: an empty string.
 */
export function cardNameHint(slug: string | undefined): string {
  const words = (slug ?? '')
    .split('-')
    .filter(Boolean)
    .map((word, i) => (i > 0 && SMALL_WORDS.has(word) ? word : capitalized(word)));
  return words.length > 1 ? [words[0], '-', ...words.slice(1)].join(' ') : words.join(' ');
}
