import {describe, it, expect} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {PLAYSTYLE_UI} from '../playstyleUi';
import {DEFAULT_FEATURED_IDS} from '../../../features/cards/components/FeaturedCards';

// Referential-integrity guard for hard-coded card ids in prod-facing config.
//
// A card rotated out of allCards.json (a Core-format rotation dropping old sets, or
// a set graduation renumbering ids) makes getCardById return undefined and the
// referencing UI render blank — a silent runtime break with no other guard. Because
// card ids are hard-coded in several syntactic forms (quoted strings, function args,
// template literals, URLs), a source-text scan is form-blind and misses some. This
// test imports the real config OBJECTS instead, so it validates resolved values and
// cannot miss a form. Add every config that hard-codes a card id here.
describe('hard-coded card-id integrity', () => {
  const {cards} = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), 'public/data/allCards.json'), 'utf8'),
  ) as {cards: Array<{id: number | string}>};
  const pool = new Set(cards.map((c) => String(c.id)));

  it('every PLAYSTYLE_UI heroCardId resolves to a card in the pool', () => {
    const dangling = Object.entries(PLAYSTYLE_UI)
      .filter(([, ui]) => !pool.has(String(ui.heroCardId)))
      .map(([key, ui]) => `${key} -> ${ui.heroCardId}`);
    expect(dangling).toEqual([]);
  });

  it('every DEFAULT_FEATURED_ID resolves to a card in the pool', () => {
    const dangling = DEFAULT_FEATURED_IDS.filter((id) => !pool.has(String(id)));
    expect(dangling).toEqual([]);
  });
});
