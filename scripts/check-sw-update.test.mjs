import {describe, expect, it} from 'vitest';
import {
  cardDataProblems,
  precacheRevision,
  renamedCardList,
  toastConstant,
  versionsOf,
  withRevision,
  withoutPrecached,
} from './check-sw-update.mjs';

const INDEX = '<!doctype html><html><head><title>Inkweave</title></head><body></body></html>';
const SW =
  'define(["./workbox-e006fe99"],function(s){s.precacheAndRoute([{url:"index.html",revision:"b46831dc654787d79fcacf362146b5b4"},' +
  '{url:"assets/index-DyMLC-Ad.js",revision:null}],{})});';
const CARDS_MD5 = '0123456789abcdef0123456789abcdef';
const FEATURED_MD5 = 'fedcba9876543210fedcba9876543210';
/** sw.js as a build that precaches the card data writes it (#1064). */
const SW_WITH_DATA =
  'define(["./workbox-e006fe99"],function(s){s.precacheAndRoute([' +
  `{url:"data/allCards.json",revision:"${CARDS_MD5}"},{url:"data/featuredCards.json",revision:"${FEATURED_MD5}"},` +
  '{url:"index.html",revision:"b46831dc654787d79fcacf362146b5b4"},{url:"assets/index-DyMLC-Ad.js",revision:null}],{})});';

describe('versionsOf', () => {
  it("gives the new deploy's sw.js another index.html revision, and nothing else", () => {
    const {old: before, new: after} = versionsOf(INDEX, SW);
    expect(before.sw).toBe(SW);
    expect(after.sw).not.toBe(SW);
    expect(after.sw.replace(/revision:"[0-9a-f]{32}"/, '')).toBe(
      SW.replace(/revision:"[0-9a-f]{32}"/, ''),
    );
  });

  it('names each version in its index.html', () => {
    const {old: before, new: after} = versionsOf(INDEX, SW);
    expect(before.index).toContain('<meta name="sw-check-version" content="old">');
    expect(after.index).toContain('<meta name="sw-check-version" content="new">');
  });

  it("gives the legacy deploy's sw.js no card data, as a worker from before it was precached", () => {
    const {legacy} = versionsOf(INDEX, SW_WITH_DATA);
    expect(precacheRevision(legacy.sw, 'data/allCards.json')).toBeNull();
    expect(precacheRevision(legacy.sw, 'data/featuredCards.json')).toBeNull();
    expect(precacheRevision(legacy.sw, 'index.html')).toBe('b46831dc654787d79fcacf362146b5b4');
    expect(legacy.index).toContain('content="old"');
  });

  it('says why when sw.js precaches no index.html', () => {
    expect(() => versionsOf(INDEX, 'self.addEventListener("fetch", () => {});')).toThrow(
      /precaches no index\.html/,
    );
  });
});

describe('toastConstant', () => {
  it('reads a number however it is written', () => {
    const name = 'UPDATE_TOAST_MAX_MS';
    expect(toastConstant('export const UPDATE_TOAST_MAX_MS = 10000;', name)).toBe(10000);
    expect(toastConstant('export const UPDATE_TOAST_MAX_MS = 10_000;', name)).toBe(10000);
    expect(toastConstant('export const UPDATE_TOAST_MAX_MS: number = 10000;', name)).toBe(10000);
  });

  it('says which number it could not find', () => {
    expect(() =>
      toastConstant('export const UPDATE_TOAST_MAX_MS = 10000;', 'UPDATE_TOAST_LEAD_MS'),
    ).toThrow(/UPDATE_TOAST_LEAD_MS not found/);
  });
});

describe('precacheRevision', () => {
  it("reads a file's revision, and null for a file sw.js doesn't precache", () => {
    expect(precacheRevision(SW_WITH_DATA, 'data/allCards.json')).toBe(CARDS_MD5);
    expect(precacheRevision(SW_WITH_DATA, 'data/previewCards.json')).toBeNull();
  });
});

describe('withRevision', () => {
  it("moves one file's revision and leaves the rest", () => {
    const moved = withRevision(SW_WITH_DATA, 'data/allCards.json', 'a'.repeat(32));
    expect(precacheRevision(moved, 'data/allCards.json')).toBe('a'.repeat(32));
    expect(precacheRevision(moved, 'data/featuredCards.json')).toBe(FEATURED_MD5);
  });

  it("says so for a file sw.js doesn't precache", () => {
    expect(() => withRevision(SW, 'data/allCards.json', 'a'.repeat(32))).toThrow(/precaches no data\/allCards\.json/);
  });
});

describe('withoutPrecached', () => {
  it('drops only the entries named, keeping the list well formed', () => {
    const dropped = withoutPrecached(SW_WITH_DATA, ['data/allCards.json', 'data/featuredCards.json']);
    expect(dropped).toBe(SW);
  });
});

describe('cardDataProblems', () => {
  const files = {
    'data/allCards.json': CARDS_MD5,
    'data/previewCards.json': null,
    'data/featuredCards.json': FEATURED_MD5,
  };

  it('passes a sw.js that precaches every card file dist has, under its MD5', () => {
    expect(cardDataProblems(SW_WITH_DATA, files)).toEqual([]);
  });

  it('names a card file sw.js leaves out', () => {
    expect(cardDataProblems(SW, files)).toEqual([
      "sw.js doesn't precache data/allCards.json",
      "sw.js doesn't precache data/featuredCards.json",
    ]);
  });

  it("names a revision that isn't the file's MD5, as after a plugin rewrote it", () => {
    const stale = {...files, 'data/allCards.json': 'b'.repeat(32)};
    expect(cardDataProblems(SW_WITH_DATA, stale)).toEqual([
      `sw.js precaches data/allCards.json as ${CARDS_MD5}, but dist's file is ${'b'.repeat(32)}`,
    ]);
  });

  it('needs the card list in dist, but not the preview cards', () => {
    expect(cardDataProblems(SW_WITH_DATA, {...files, 'data/allCards.json': null})).toEqual([
      'dist has no data/allCards.json',
    ]);
  });
});

describe('renamedCardList', () => {
  it("renames the first card of a list or of a file's cards, and nothing else", () => {
    const cards = [{id: 1, name: 'Elsa', fullName: 'Elsa - Snow Queen'}, {id: 2, name: 'Anna', fullName: 'Anna'}];
    expect(JSON.parse(renamedCardList(JSON.stringify({sets: {}, cards}), 'Marker')).cards).toEqual([
      {id: 1, name: 'Marker', fullName: 'Marker'},
      cards[1],
    ]);
    expect(JSON.parse(renamedCardList(JSON.stringify(cards), 'Marker'))[0].name).toBe('Marker');
  });
});
