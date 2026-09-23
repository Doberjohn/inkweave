import type {LorcanaJSONCard} from 'inkweave-synergy-engine';

/** Parse a previewCards.json text and return its `cards` array, or throw. */
function parseCards(fileText: string, which: 'input' | 'output'): unknown[] {
  let parsed: {cards?: unknown};
  try {
    parsed = JSON.parse(fileText) as {cards?: unknown};
  } catch {
    throw new Error(`previewCards.json: the ${which} is not valid JSON`);
  }
  if (!Array.isArray(parsed.cards)) throw new Error(`previewCards.json: the ${which} has no cards array`);
  return parsed.cards;
}

/**
 * Append a card to the `cards` array of a previewCards.json file *textually*,
 * preserving everything before the array close byte-for-byte (small diff).
 *
 * Assumes `cards` is the last array in the file (it is — the file ends
 * `...    }\n  ]\n}\n`, or `"cards": []\n}\n` right after a set graduates). The
 * new entry is serialized at 2-space indent, then shifted 4 spaces to sit
 * inside the array.
 *
 * reveal-admin commits the result straight to master with no gate in between,
 * so this fails closed: it throws unless the output parses and its `cards`
 * array is the input's plus exactly this card.
 */
export function insertCardIntoPreviewJson(fileText: string, card: LorcanaJSONCard): string {
  const countBefore = parseCards(fileText, 'input').length;

  const closeIdx = fileText.lastIndexOf(']');
  const before = fileText.slice(0, closeIdx); // up to (not incl.) the closing ']'
  const after = fileText.slice(closeIdx); // ']' + trailing '}' / newline

  const entry = JSON.stringify(card, null, 2)
    .split('\n')
    .map((line) => '    ' + line)
    .join('\n');

  // `before` ends with the last entry's '}' (or the array's own '[' when it is
  // empty) then whitespace before ']'. Trim that whitespace, add our entry after
  // a comma only when there is an entry to follow, then re-indent the ']' by 2.
  const trimmed = before.replace(/\s*$/, '');
  const separator = trimmed.endsWith('[') ? '' : ',';
  const result = `${trimmed}${separator}\n${entry}\n  ${after}`;

  const cardsAfter = parseCards(result, 'output');
  const inserted = JSON.stringify(cardsAfter.at(-1)) === JSON.stringify(card);
  if (cardsAfter.length !== countBefore + 1 || !inserted) {
    throw new Error('previewCards.json: the card did not land at the end of the cards array');
  }
  return result;
}
