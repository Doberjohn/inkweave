import {describe, it, expect} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {INK_HUBS, getInkHub, cardsForInk} from '../inkHubs';
import {loadCardsFromJSON} from '../loader';

/**
 * Read the real corpus, not a fixture. The whole premise of #530 is a claim ABOUT the
 * corpus — that ink partitions it totally — so a hand-written fixture would only test
 * that the test agrees with itself.
 *
 * Goes through loadCardsFromJSON rather than the raw JSON because the transform is what
 * splits `color: "Amethyst-Sapphire"` into `ink` + `ink2`. Reading the raw field would
 * test a shape the app never sees.
 */
const raw = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, '../../../../public/data/allCards.json'),
    'utf8',
  ),
);
const cards = loadCardsFromJSON(raw);

describe('ink hubs', () => {
  it('covers EVERY card — the property the whole issue rests on', () => {
    const covered = new Set<string>();
    for (const hub of INK_HUBS) {
      for (const card of cardsForInk(cards, hub.ink)) covered.add(card.id);
    }
    expect(covered.size).toBe(cards.length);
  });

  it('keeps every hub under the 204 display cap', () => {
    // LAYOUT.maxDisplayedCards truncates SILENTLY. A hub over the cap would render fewer
    // anchors than it claims and the missing cards would be invisible orphans that look
    // covered — the exact failure this issue exists to prevent. Set pages were deferred
    // because sets 9 and 13 already breach it at 205 and 207.
    for (const hub of INK_HUBS) {
      expect(cardsForInk(cards, hub.ink).length).toBeLessThanOrEqual(204);
    }
  });

  it('places dual-ink cards on both of their hubs', () => {
    const dual = cards.filter((c) => c.ink2);
    expect(dual.length).toBeGreaterThan(0);
    for (const card of dual) {
      expect(cardsForInk(cards, card.ink)).toContain(card);
      expect(cardsForInk(cards, card.ink2!)).toContain(card);
    }
  });

  it('produces one hub slot per ink per card', () => {
    const slots = INK_HUBS.reduce((n, hub) => n + cardsForInk(cards, hub.ink).length, 0);
    const dual = cards.filter((c) => c.ink2).length;
    expect(slots).toBe(cards.length + dual);
  });

  it('resolves known slugs and rejects unknown ones', () => {
    expect(getInkHub('steel')?.ink).toBe('Steel');
    expect(getInkHub('nonsense')).toBeUndefined();
    expect(getInkHub(undefined)).toBeUndefined();
  });

  it('has six hubs with unique lowercase slugs', () => {
    expect(INK_HUBS).toHaveLength(6);
    expect(new Set(INK_HUBS.map((h) => h.slug)).size).toBe(6);
    for (const hub of INK_HUBS) expect(hub.slug).toBe(hub.ink.toLowerCase());
  });
});
