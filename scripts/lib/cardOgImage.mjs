/**
 * Each card page's link preview image (#1133): what scripts/generate-og-images.mjs draws for a
 * card, the name it saves the JPEG under, and the tags scripts/prerender.mjs writes into the
 * card's captured page so Facebook, Discord, Reddit and X show the card instead of the site
 * banner. Pure apart from hashing, so scripts/lib/__tests__/cardOgImage.test.mjs drives it whole.
 *
 * The image names the card's best partners. A partner's tag is the label of the synergy group it
 * scores highest in, as the card page lists them, so the image and the page agree on the words.
 */
import {createHash} from 'node:crypto';
import {SITE_ORIGIN} from './siteOrigin.mjs';

/** The size Facebook, X and Discord all show at full width. */
export const OG_IMAGE_SIZE = {width: 1200, height: 630};

/** Where the images are served, under the deploy's root. */
export const OG_CARD_DIR = 'og/card';

/**
 * Where scripts/generate-og-images.mjs records each card's image, `{[id]: {file, alt}}`, for
 * scripts/prerender.mjs, relative to the repo root: outside dist, so the deploy doesn't serve it.
 */
export const OG_MANIFEST = 'apps/web/node_modules/.cache/og-cards.json';

/** How many partners the image shows. */
const PARTNER_COUNT = 3;

/**
 * Each ink's glow around the card, `INK_COLORS[ink].border` in
 * packages/ui/src/tokens/lorcana.ts (a root script can't import the package's TypeScript; the
 * test reads that file and fails when the two differ).
 */
export const INK_GLOW = {
  Amber: '#f59e0b',
  Amethyst: '#8b5cf6',
  Emerald: '#10b981',
  Ruby: '#ef4444',
  Sapphire: '#3b82f6',
  Steel: '#6b7280',
};

/** The brand gold, for a card whose ink the data doesn't name. */
const FALLBACK_GLOW = '#ffb900';

/** A dual-ink card's color reads "Amethyst-Sapphire"; the first ink leads. */
const inksOf = (card) => (card.color ?? '').split('-').filter(Boolean);

/** Each partner's tag: the label of the group it scores highest in, the first such on a tie. */
function partnerTags(groups) {
  const best = new Map();
  for (const {label, synergies} of groups) {
    for (const {cardId, score} of synergies) {
      const held = best.get(cardId);
      if (!held || score > held.score) best.set(cardId, {score, label});
    }
  }
  return new Map([...best].map(([id, {label}]) => [id, label]));
}

/** Partners best first: the pair's aggregate score, then the lower card id. */
function rankPartners(pairs) {
  return Object.entries(pairs)
    .map(([id, pair]) => ({id, score: pair.aggregateScore}))
    .sort((a, b) => b.score - a.score || Number(a.id) - Number(b.id));
}

/** The first `count` entries of `ranked` whose tags differ, then the next best, in rank order. */
function distinctFirst(ranked, count) {
  const tags = new Set();
  const firstOfEachTag = ranked.filter(({tag}) => !tags.has(tag) && tags.add(tag)).slice(0, count);
  const rest = ranked.filter((partner) => !firstOfEachTag.includes(partner));
  const picked = new Set([...firstOfEachTag, ...rest.slice(0, count - firstOfEachTag.length)]);
  return ranked.filter((partner) => picked.has(partner));
}

/**
 * The partners the image shows, each `{id, tag}`: the best pairs whose tags differ, so the row
 * shows three ways the card plays rather than three of one; fewer distinct tags fill the row
 * with the next best pairs. `hasArt` leaves out a partner the build has no image for.
 *
 * @param {{groups: Array, pairs: Record<string, {aggregateScore: number}>}} synergyFile
 * @param {(id: string) => boolean} hasArt
 */
export function pickPartners({groups, pairs}, hasArt) {
  const tags = partnerTags(groups);
  const ranked = rankPartners(pairs)
    .filter(({id}) => hasArt(id))
    .map(({id}) => ({id, tag: tags.get(id) ?? ''}));
  return distinctFirst(ranked, PARTNER_COUNT);
}

/** A card's art as the templates draw it. Locations are printed sideways, so they turn upright. */
export function artOf(card) {
  return {
    src: `/card-images/${card.id}.${card.imageHash}.avif`,
    landscape: card.type === 'Location',
  };
}

/** The glow around `card`: its ink's, the first ink's for a dual-ink card. */
export const inkGlow = (card) => INK_GLOW[inksOf(card)[0]] ?? FALLBACK_GLOW;

/** "Ruby · Rare character", for a card with no partners to count. */
function cardLine(card) {
  const kind = [card.rarity, card.type?.toLowerCase()].filter(Boolean).join(' ');
  return [inksOf(card).join(' and '), kind].filter(Boolean).join(' · ');
}

const cardsWord = (count) => (count === 1 ? '1 card' : `${count} cards`);

/**
 * What the template fills for `card`. `synergyFile` is its `data/synergies/{id}.json`, or null
 * when the card has none (precompute writes no file then).
 *
 * @param {object} card - the card as allCards.json holds it, `imageHash` included
 * @param {object | null} synergyFile
 * @param {Map<string, object>} cardsById - every card, by id as a string, for the partners' art
 */
export function cardOgData(card, synergyFile, cardsById) {
  const partnerCount = synergyFile ? Object.keys(synergyFile.pairs).length : 0;
  const hasArt = (id) => Boolean(cardsById.get(id)?.imageHash);
  const partners = synergyFile ? pickPartners(synergyFile, hasArt) : [];
  return {
    hero: artOf(card),
    name: card.name,
    version: card.version ?? '',
    glow: inkGlow(card),
    kicker: partnerCount > 0 ? `Pairs with ${cardsWord(partnerCount)}` : cardLine(card),
    partners: partners.map(({id, tag}) => ({...artOf(cardsById.get(id)), tag})),
  };
}

/** The image's alt text, which says what it shows. */
export function ogImageAlt(card, data) {
  return data.partners.length > 0
    ? `${card.fullName} and its best Lorcana partners on Inkweave`
    : `${card.fullName}, a Lorcana card on Inkweave`;
}

/**
 * The image's file name: the card's id and a hash of the bytes, so a changed image gets a new
 * URL. That is what lets vercel.json serve /og/ as `immutable` (never on a name without one,
 * #323), and what makes Facebook fetch the new image instead of its cached copy.
 */
export function ogFileName(id, jpegBytes) {
  const hash = createHash('sha256').update(jpegBytes).digest('hex').slice(0, 16);
  return `${id}.${hash}.jpg`;
}

/** The pattern a saved image's file name matches, for `id`. */
export const ogFileNamePattern = (id) => new RegExp(`^${id}\\.[0-9a-f]{16}\\.jpg$`);

/** An image's absolute URL, as og:image needs it: a card's in OG_CARD_DIR, a page's in og/page. */
export const ogImageUrl = (dir, fileName) => `${SITE_ORIGIN}/${dir}/${fileName}`;

/**
 * The tags that carry a page's preview image. index.html sets each one once, for the site
 * banner; the crawl swaps their contents for the page's own image.
 */
const IMAGE_TAGS = [
  {attr: 'property', key: 'og:image', field: 'url'},
  {attr: 'property', key: 'og:image:alt', field: 'alt'},
  {attr: 'name', key: 'twitter:image', field: 'url'},
  {attr: 'name', key: 'twitter:image:alt', field: 'alt'},
];

/** Every `<meta>` tag in `html` whose `attr` is exactly `key`: og:image never matches og:image:alt. */
function metaTags(html, {attr, key}) {
  return html.match(new RegExp(`<meta\\b[^>]*\\b${attr}="${key}"[^>]*>`, 'g')) ?? [];
}

/** The `content` of the one `<meta>` tag whose `attr` is `key`, or null when there is none. */
export function readMetaContent(html, tag) {
  const [first] = metaTags(html, tag);
  return first?.match(/\bcontent="([^"]*)"/)?.[1] ?? null;
}

const escapeAttr = (text) =>
  text
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');

/**
 * `html` with its preview image tags pointing at `image` (`{url, alt}`). Throws unless the page
 * holds each tag exactly once: a page without them would keep no image at all, and a second
 * og:image would leave the platform to pick one.
 */
export function withOgImage(html, image) {
  return IMAGE_TAGS.reduce((out, tag) => {
    const found = metaTags(out, tag);
    if (found.length !== 1) throw new Error(`expected one ${tag.key} tag, found ${found.length}`);
    // Replacer functions, so a `$` in the alt text is never read as a replacement pattern.
    const content = `content="${escapeAttr(image[tag.field])}"`;
    const swapped = found[0].replace(/\bcontent="[^"]*"/, () => content);
    return out.replace(found[0], () => swapped);
  }, html);
}

/**
 * Each card page's image, by the page's route: what scripts/prerender.mjs writes into the page.
 * `manifest` is what scripts/generate-og-images.mjs saved, `{[id]: {file, alt}}`; a card it has
 * no image for keeps the site banner.
 */
export function ogImagesByRoute(cards, manifest, cardPath) {
  return new Map(
    cards
      .filter((card) => manifest[card.id])
      .map((card) => {
        const {file, alt} = manifest[card.id];
        return [cardPath(card), {url: ogImageUrl(OG_CARD_DIR, file), alt}];
      }),
  );
}
