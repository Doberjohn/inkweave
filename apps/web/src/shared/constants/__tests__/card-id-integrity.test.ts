import {describe, it, expect} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {PLAYSTYLE_UI} from '../playstyleUi';
import {DEFAULT_FEATURED_IDS} from '../../../features/cards/featured';

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
  // Preview cards count too: the app merges previewCards.json into the pool at runtime, and
  // scripts/graduate-canonical-set.mjs retargets these ids when their set graduates.
  const readCards = (file: string) =>
    (
      JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'public/data', file), 'utf8')) as {
        cards: Array<{id: number | string}>;
      }
    ).cards;
  const pool = new Set(
    [...readCards('allCards.json'), ...readCards('previewCards.json')].map((c) => String(c.id)),
  );

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
