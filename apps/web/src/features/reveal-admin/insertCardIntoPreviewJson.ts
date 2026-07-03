import type {LorcanaJSONCard} from 'inkweave-synergy-engine';

/**
 * Append a card to the `cards` array of a previewCards.json file *textually*,
 * preserving everything before the array close byte-for-byte (small diff).
 *
 * Assumes `cards` is the last array in the file (it is — the file ends
 * `...    }\n  ]\n}\n`) and is non-empty. The new entry is serialized at
 * 2-space indent, then shifted 4 spaces to sit inside the array.
 */
export function insertCardIntoPreviewJson(fileText: string, card: LorcanaJSONCard): string {
  const closeIdx = fileText.lastIndexOf(']');
  if (closeIdx === -1) throw new Error('previewCards.json: could not find the cards array close');

  const before = fileText.slice(0, closeIdx); // up to (not incl.) the closing ']'
  const after = fileText.slice(closeIdx); // ']' + trailing '}' / newline

  const entry = JSON.stringify(card, null, 2)
    .split('\n')
    .map((line) => '    ' + line)
    .join('\n');

  // `before` ends with the last entry's '}' then whitespace before ']'. Trim the
  // trailing whitespace, add a comma + our entry, then re-indent the ']' by 2.
  const trimmed = before.replace(/\s*$/, '');
  return `${trimmed},\n${entry}\n  ${after}`;
}
