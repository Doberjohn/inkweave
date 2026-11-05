import {describe, it, expect} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  INK_GLOW,
  cardOgData,
  ogFileName,
  ogFileNamePattern,
  ogImageAlt,
  ogImagesByRoute,
  pickPartners,
  readMetaContent,
  withCardOgImage,
} from '../cardOgImage.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const INDEX_HTML = fs.readFileSync(path.join(ROOT, 'apps/web/index.html'), 'utf8');
const LORCANA_TOKENS = fs.readFileSync(
  path.join(ROOT, 'packages/ui/src/tokens/lorcana.ts'),
  'utf8',
);

/** A synergy file as precompute writes it: groups the card page lists, and each pair's score. */
const synergyFile = (groups, scores) => ({
  groups: groups.map(([label, synergies]) => ({
    label,
    synergies: synergies.map(([cardId, score]) => ({cardId, score})),
  })),
  pairs: Object.fromEntries(
    Object.entries(scores).map(([id, aggregateScore]) => [id, {aggregateScore}]),
  ),
});

const card = (id, extra = {}) => ({
  id,
  name: `Card ${id}`,
  version: 'Version',
  fullName: `Card ${id} - Version`,
  type: 'Character',
  color: 'Ruby',
  rarity: 'Rare',
  imageHash: `hash${id}`,
  ...extra,
});

const withArt = () => true;

describe('pickPartners', () => {
  it('takes the best pairs, ties going to the lower card id, and tags each with its strongest group', () => {
    const file = synergyFile(
      [
        [
          'Bounce',
          [
            ['30', 8],
            ['20', 8],
            ['40', 5],
          ],
        ],
        [
          'Heroes',
          [
            ['20', 9],
            ['10', 6],
          ],
        ],
      ],
      {10: 6, 20: 8, 30: 8, 40: 5},
    );
    expect(pickPartners(file, withArt)).toEqual([
      {id: '20', tag: 'Heroes'},
      {id: '30', tag: 'Bounce'},
      {id: '10', tag: 'Heroes'},
    ]);
  });

  it('shows three different tags before a second of one, keeping the row in score order', () => {
    const file = synergyFile(
      [
        [
          'Bounce',
          [
            ['1', 8],
            ['2', 8],
            ['3', 8],
          ],
        ],
        ['Ramp', [['4', 6]]],
        ['Items', [['5', 5]]],
      ],
      {1: 8, 2: 8, 3: 8, 4: 6, 5: 5},
    );
    expect(pickPartners(file, withArt).map((p) => p.id)).toEqual(['1', '4', '5']);
  });

  it('fills the row with the next best pairs when fewer than three tags differ', () => {
    const file = synergyFile(
      [
        [
          'Singer + Songs',
          [
            ['1', 7],
            ['2', 6],
            ['3', 5],
            ['4', 4],
          ],
        ],
      ],
      {
        1: 7,
        2: 6,
        3: 5,
        4: 4,
      },
    );
    expect(pickPartners(file, withArt).map((p) => p.id)).toEqual(['1', '2', '3']);
  });

  it('leaves out a partner without art', () => {
    const file = synergyFile(
      [
        [
          'Ramp',
          [
            ['1', 8],
            ['2', 7],
          ],
        ],
      ],
      {1: 8, 2: 7},
    );
    expect(pickPartners(file, (id) => id !== '1')).toEqual([{id: '2', tag: 'Ramp'}]);
  });
});

describe('cardOgData', () => {
  const partners = new Map([['2', card(2, {type: 'Location'})]]);

  it('counts the partners, glows in the first ink and turns a Location upright', () => {
    const file = synergyFile([['Locations', [['2', 7]]]], {2: 7});
    const data = cardOgData(card(1, {color: 'Amethyst-Sapphire'}), file, partners);
    expect(data).toMatchObject({
      kicker: 'Pairs with 1 card',
      glow: INK_GLOW.Amethyst,
      hero: {src: '/card-images/1.hash1.avif', landscape: false},
      partners: [{src: '/card-images/2.hash2.avif', landscape: true, tag: 'Locations'}],
    });
    expect(ogImageAlt(card(1), data)).toBe(
      'Card 1 - Version and its best Lorcana synergy partners',
    );
  });

  it('names the ink, rarity and type of a card with no synergies, and shows no partners', () => {
    const data = cardOgData(card(1, {color: 'Ruby-Steel', type: 'Action'}), null, partners);
    expect(data.kicker).toBe('Ruby and Steel · Rare action');
    expect(data.partners).toEqual([]);
    expect(ogImageAlt(card(1), data)).toBe('Card 1 - Version, a Lorcana card');
  });

  it("glows in the app's own ink colors (INK_COLORS' borders)", () => {
    for (const [ink, color] of Object.entries(INK_GLOW)) {
      expect(LORCANA_TOKENS).toMatch(new RegExp(`${ink}: \\{[^}]*border: '${color}'`));
    }
  });
});

describe('ogFileName', () => {
  it("names the image by the card's id and a hash of its bytes", () => {
    const name = ogFileName(3354, Buffer.from('jpeg'));
    expect(name).toMatch(ogFileNamePattern(3354));
    expect(ogFileName(3354, Buffer.from('jpeg'))).toBe(name);
    expect(ogFileName(3354, Buffer.from('other'))).not.toBe(name);
  });
});

describe('withCardOgImage', () => {
  const image = {
    url: 'https://inkweave.ink/og/card/1.0123456789abcdef.jpg',
    alt: 'Ariel & "Flounder"',
  };

  it("swaps index.html's image tags and their alt text for the card's, leaving the size tags", () => {
    const html = withCardOgImage(INDEX_HTML, image);
    for (const tag of [
      {attr: 'property', key: 'og:image'},
      {attr: 'name', key: 'twitter:image'},
    ]) {
      expect(readMetaContent(html, tag)).toBe(image.url);
    }
    expect(html).toContain('property="og:image:alt" content="Ariel &amp; &quot;Flounder&quot;"');
    expect(html).toContain('name="twitter:image:alt" content="Ariel &amp; &quot;Flounder&quot;"');
    expect(readMetaContent(html, {attr: 'property', key: 'og:image:width'})).toBe('1200');
  });

  it('throws on a page without an image tag, or with two', () => {
    const missing = INDEX_HTML.replace(/<meta property="og:image" [^>]*>/, '');
    const doubled = INDEX_HTML.replace(
      '<meta name="twitter:card"',
      '<meta property="og:image" content="x" />$&',
    );
    expect(() => withCardOgImage(missing, image)).toThrow('expected one og:image tag, found 0');
    expect(() => withCardOgImage(doubled, image)).toThrow('expected one og:image tag, found 2');
  });
});

describe('readMetaContent', () => {
  it("reads a tag's content whatever order its attributes come in", () => {
    const html = '<meta content="b.jpg" data-x="" property="og:image">';
    expect(readMetaContent(html, {attr: 'property', key: 'og:image'})).toBe('b.jpg');
    expect(readMetaContent(html, {attr: 'name', key: 'twitter:image'})).toBeNull();
  });
});

describe('ogImagesByRoute', () => {
  it("maps each card page to its image, leaving out a card the build didn't draw", () => {
    const manifest = {1: {file: '1.0123456789abcdef.jpg', alt: 'One'}};
    const byRoute = ogImagesByRoute([card(1), card(2)], manifest, (c) => `/card/${c.id}/x`);
    expect([...byRoute]).toEqual([
      ['/card/1/x', {url: 'https://inkweave.ink/og/card/1.0123456789abcdef.jpg', alt: 'One'}],
    ]);
  });
});
