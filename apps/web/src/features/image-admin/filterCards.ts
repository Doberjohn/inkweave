import type {LorcanaCard} from 'inkweave-synergy-engine';

/**
 * Filter the card list for the image-admin picker. Matches the query against
 * card fields (case-insensitive) and returns at most `limit` cards. A blank
 * query returns the head of the list.
 */
export function filterCards(cards: LorcanaCard[], query: string, limit = 40): LorcanaCard[] {
  const q = query.trim().toLowerCase();
  if (q === '') return cards.slice(0, limit);

  // fullName is "name - version", so matching it covers name and version in one
  // check; id (a numeric string) needs its own.
  const matches = cards.filter(
    (c) => c.fullName.toLowerCase().includes(q) || c.id.includes(q),
  );
  // Surface prefix matches first ("els" -> "Elsa" before "Consuela"); sort is
  // stable, so same-rank cards keep their original order.
  matches.sort((a, b) => {
    const aPrefix = a.fullName.toLowerCase().startsWith(q) ? 0 : 1;
    const bPrefix = b.fullName.toLowerCase().startsWith(q) ? 0 : 1;
    return aPrefix - bPrefix;
  });
  return matches.slice(0, limit);
}
