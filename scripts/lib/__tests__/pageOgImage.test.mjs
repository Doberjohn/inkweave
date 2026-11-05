import {describe, it, expect} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  PLAYSTYLE_UI_FILE,
  REVEAL_SET_FILE,
  homeOgData,
  ogImageForRoute,
  pageOgImagesByRoute,
  pageOgKey,
  parsePlaystyleUi,
  parseRevealSet,
  playstyleOgData,
  isRevealSeasonActive,
  revealsOgData,
} from '../pageOgImage.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

/** A card as allCards.json holds it, with art unless told otherwise. */
const card = (id, fullName, extra = {}) => ({
  id,
  fullName,
  name: fullName.split(' - ')[0],
  color: 'Amber',
  type: 'Character',
  imageHash: `h${id}`,
  ...extra,
});
const byId = (cards) => new Map(cards.map((c) => [String(c.id), c]));
const art = (id) => `/card-images/${id}.h${id}.avif`;

describe('parsePlaystyleUi', () => {
  it("reads every playstyle the engine's catalog lists from the app's real file", () => {
    const ui = parsePlaystyleUi(read(PLAYSTYLE_UI_FILE));
    const catalog = JSON.parse(read('packages/synergy-engine/dist/catalog.json'));
    for (const {id} of catalog.playstyles) {
      expect(ui[id], id).toEqual({accent: expect.stringMatching(/^#[0-9a-f]{6}$/i), heroId: expect.stringMatching(/^\d+$/)});
    }
  });

  it('reads quoted and bare ids, and nothing from other lines', () => {
    const text = [
      "  'lore-denial': makeUiMeta('#ef4444', 'mechanic', '2847'), // Hero Work",
      "  bounce: makeUiMeta('#8b5cf6', 'mechanic', '2500'),",
      "function makeUiMeta(accentColor: string, kind: string, heroCardId: string) {",
    ].join('\n');
    expect(parsePlaystyleUi(text)).toEqual({
      'lore-denial': {accent: '#ef4444', heroId: '2847'},
      bounce: {accent: '#8b5cf6', heroId: '2500'},
    });
  });
});

describe('parseRevealSet', () => {
  it("reads the app's real file to a set code and a positive total", () => {
    const {code, total} = parseRevealSet(read(REVEAL_SET_FILE));
    expect(code).toMatch(/^\d+$/);
    expect(total).toBeGreaterThan(0);
  });

  it('sums PER_INK, and throws when the code or the counts are missing', () => {
    const perInk = 'export const PER_INK: Record<Ink, number> = {\n  Amber: 30,\n  Steel: 12,\n};';
    expect(parseRevealSet(`export const REVEAL_SET_CODE = '15' satisfies SetCode;\n${perInk}`)).toEqual({
      code: '15',
      total: 42,
    });
    expect(() => parseRevealSet(perInk)).toThrow(REVEAL_SET_FILE);
    expect(() => parseRevealSet("export const REVEAL_SET_CODE = '15';")).toThrow(REVEAL_SET_FILE);
  });
});

describe('isRevealSeasonActive', () => {
  const NOW = new Date('2026-11-05T12:00:00Z');

  it("is live while a set's release date is still ahead, and only then", () => {
    const preview = {sets: {14: {releaseDate: '2026-10-23'}, 15: {releaseDate: '2027-02-13'}}};
    expect(isRevealSeasonActive(preview, NOW)).toBe(true);
    expect(isRevealSeasonActive({sets: {14: {releaseDate: '2026-10-23'}}}, NOW)).toBe(false);
    expect(isRevealSeasonActive({sets: {15: {}}}, NOW)).toBe(false);
    expect(isRevealSeasonActive(undefined, NOW)).toBe(false);
  });
});

describe('homeOgData', () => {
  it("draws the featured cards with the list's art, each in its ink, and leaves out one without art", () => {
    const cards = [
      card(1, 'Miguel Rivera - Street Musician'),
      card(2, 'Un Poco Loco', {color: 'Amethyst'}),
      card(3, 'Max Goof - Karaoke Star', {color: 'Emerald', imageHash: undefined}),
    ];
    expect(homeOgData([1, '2', 3, 99], byId(cards))).toEqual({
      route: '/',
      kind: 'home',
      alt: 'Inkweave: find the Lorcana cards that work together',
      data: {
        cards: [
          {src: art(1), ink: '#f59e0b'},
          {src: art(2), ink: '#8b5cf6'},
        ],
      },
    });
  });
});

describe('playstyleOgData', () => {
  const playstyle = {id: 'bounce', name: 'Bounce', tagline: 'Return characters from play to hand.'};
  const ui = {accent: '#8b5cf6', heroId: '5'};
  const cards = [
    card(1, 'Zeus - Mr. Lightning Bolts'),
    card(2, 'Belle - Bookworm'),
    card(3, 'Agrabah - Marketplace', {type: 'Location'}),
    card(4, 'Aladdin - Heroic Outlaw', {imageHash: undefined}),
    card(5, 'Tigger - Bouncing All the Way'),
    card(6, 'Belle - Strange but Special'),
    card(7, 'Goofy - Musketeer'),
    card(8, 'Pongo - Determined Father'),
  ];
  const job = (overrides = {}) =>
    playstyleOgData({playstyle, memberIds: cards.map((c) => c.id), ui, cardsById: byId(cards), ...overrides});

  it("fans the hero, then the playstyle's cards by name, leaving out Locations and cards without art", () => {
    expect(job().data.cards).toEqual([art(5), art(2), art(6), art(7), art(8)]);
  });

  it("names the fan's first three distinct names, the card count, and the page's words", () => {
    expect(job()).toEqual({
      route: '/playstyles/bounce',
      kind: 'playstyle',
      alt: 'Bounce Lorcana playstyle on Inkweave, with Tigger - Bouncing All the Way and more of its cards',
      data: expect.objectContaining({
        glow: '#8b5cf6',
        kicker: 'Lorcana playstyle · 8 cards',
        title: 'Bounce',
        sub: 'Return characters from play to hand.',
        keys: 'Tigger · Belle · Goofy',
      }),
    });
  });

  it('leads with the first card by name when the hero is gone, and is null when no card can be drawn', () => {
    expect(job({ui: {...ui, heroId: '404'}}).data.cards[0]).toBe(art(2));
    expect(job({memberIds: [3, 4], ui: {...ui, heroId: '404'}})).toBeNull();
  });
});

describe('revealsOgData', () => {
  const set = {code: '15', name: 'Ever After', total: 204};

  it('fans the newest five revealed cards with art, newest first, and counts every revealed card', () => {
    const revealed = [
      ...Array.from({length: 6}, (_, i) => card(15001 + i, `Card ${i + 1}`)),
      card(15007, 'Fairy Tale Castle', {type: 'Location'}),
      card(15008, 'Card 8', {imageHash: undefined}),
    ];
    expect(revealsOgData(revealed, set)).toEqual({
      route: '/reveals',
      kind: 'reveals',
      alt: 'Ever After reveals on Inkweave: 8 of 204 cards revealed',
      data: {
        kicker: 'Set 15 reveals',
        title: 'Ever After',
        sub: '8 of 204 cards revealed',
        progress: 8 / 204,
        cards: [art(15006), art(15005), art(15004), art(15003), art(15002)],
      },
    });
  });

  it('fans what there is early in a season, and never fills the bar past full', () => {
    expect(revealsOgData([card(15001, 'Card 1')], set).data.cards).toEqual([art(15001)]);
    const three = [card(15001, 'Card 1'), card(15002, 'Card 2'), card(15003, 'Card 3')];
    expect(revealsOgData(three, {...set, total: 2}).data.progress).toBe(1);
  });
});

describe('pageOgKey', () => {
  it("names a page's own image for home, a playstyle page and /reveals, and the home image elsewhere", () => {
    expect(pageOgKey('/')).toBe('home');
    expect(pageOgKey('/playstyles/ink-drops')).toBe('playstyle-ink-drops');
    expect(pageOgKey('/reveals')).toBe('reveals');
    expect(pageOgKey('/playstyles')).toBe('home');
    expect(pageOgKey('/ink/amber')).toBe('home');
  });
});

describe('ogImageForRoute', () => {
  const record = {
    '/': {file: 'home.0123456789abcdef.jpg', alt: 'home'},
    '/playstyles/bounce': {file: 'playstyle-bounce.0123456789abcdef.jpg', alt: 'bounce'},
  };
  const pages = pageOgImagesByRoute(record);
  const cards = new Map([['/card/1/elsa', {url: 'card', alt: 'Elsa'}]]);

  it('gives a card page its own image, a page its own, and every other page the home image', () => {
    expect(pages.get('/playstyles/bounce')).toEqual({
      url: 'https://inkweave.ink/og/page/playstyle-bounce.0123456789abcdef.jpg',
      alt: 'bounce',
    });
    expect(ogImageForRoute('/card/1/elsa', {cards, pages})).toEqual({url: 'card', alt: 'Elsa'});
    expect(ogImageForRoute('/playstyles/bounce', {cards, pages})).toBe(pages.get('/playstyles/bounce'));
    expect(ogImageForRoute('/browse', {cards, pages})).toBe(pages.get('/'));
    expect(ogImageForRoute('/card/2/anna', {cards, pages})).toBe(pages.get('/'));
  });

  it('leaves the site banner when the home image was never drawn', () => {
    expect(ogImageForRoute('/browse', {cards, pages: new Map()})).toBeUndefined();
  });
});
