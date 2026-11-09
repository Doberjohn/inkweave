import {describe, it, expect} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  isCoreSet,
  synergyEngine,
  transformCards,
  type Ink,
  type LorcanaJSONCard,
} from 'inkweave-synergy-engine';
import {
  INK_HUBS,
  INK_HUB_BLURBS,
  INK_HUB_PLAYSTYLES,
  getInkHub,
  cardsForInk,
  inkHubDescription,
} from '../inkHubs';
import {getAllPlaystyles} from '../../synergies/engineCatalog';
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

describe('INK_HUB_PLAYSTYLES', () => {
  // The cards precompute hands the engine, so each playstyle's cards here are its _playstyles.json
  // list. allCards.json wins an id both files hold, as in the app's card list.
  const [primary, preview] = ['allCards.json', 'previewCards.json'].map(
    (file) =>
      (
        JSON.parse(
          fs.readFileSync(path.resolve(__dirname, '../../../../public/data', file), 'utf8'),
        ) as {cards: LorcanaJSONCard[]}
      ).cards,
  );
  const primaryIds = new Set(primary.map((c) => c.id));
  const pool = transformCards(
    [...primary, ...preview.filter((c) => !primaryIds.has(c.id))].filter((c) =>
      isCoreSet(c.setCode),
    ),
  );
  const shares = getAllPlaystyles()
    .map(({id}) => ({id, members: synergyEngine.getPlaystyleCards(id, pool)}))
    .filter(({members}) => members.length > 0);

  /** The ink's playstyles, largest share of their cards in it first. */
  const ranked = (ink: Ink) =>
    shares
      .map(({id, members}) => ({id, share: cardsForInk(members, ink).length / members.length}))
      .sort((a, b) => b.share - a.share || a.id.localeCompare(b.id))
      .map(({id}) => id);

  it('names, for each ink, three playstyles from the five with the largest share of their cards in it', () => {
    for (const {ink} of INK_HUBS) {
      const topFive = ranked(ink).slice(0, 5);
      const outside = INK_HUB_PLAYSTYLES[ink].filter((id) => !topFive.includes(id));
      expect({ink, outside}).toEqual({ink, outside: []});
    }
  });

  it('gives every hub a description a search result shows whole, from its own blurb', () => {
    for (const hub of INK_HUBS) {
      const description = inkHubDescription(hub.ink);
      expect(description.length, hub.ink).toBeLessThanOrEqual(160);
      const lead = INK_HUB_BLURBS[hub.ink].split('. ')[0];
      expect(lead.length, hub.ink).toBeGreaterThan(0);
      expect(description.startsWith(`${lead}. Browse every ${hub.ink} card`), hub.ink).toBe(true);
      expect(description, hub.ink).toContain('Disney Lorcana');
    }
  });

  it('falls back to the listing line for a blurb with no sentence break', () => {
    expect(inkHubDescription('Ruby', 'Ruby attacks')).toBe(
      'Browse every Ruby card in Disney Lorcana Core format and the synergies each one brings.',
    );
  });
});
