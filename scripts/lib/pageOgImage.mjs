/**
 * The link preview images of the pages that aren't cards (#1135): the home page, each playstyle
 * page and, in reveal season, /reveals. What scripts/generate-og-images.mjs draws for each, the
 * key its file is named by, and which image the crawl (scripts/prerender.mjs) writes into each
 * captured page: a card page its card's own (scripts/lib/cardOgImage.mjs), these pages their
 * own, and every other page the home image. Pure, so scripts/lib/__tests__/pageOgImage.test.mjs
 * drives it whole.
 *
 * Two inputs live in the app's TypeScript, which a root script can't import: each playstyle's
 * hero card and accent (PLAYSTYLE_UI) and the reveal set's size (PER_INK). The parsers below read
 * those files as text, and the tests fail when the real files stop parsing.
 */
import {SITE_ORIGIN} from './siteOrigin.mjs';
import {artOf, inkGlow} from './cardOgImage.mjs';

/** Where the images are served, under the deploy's root. */
export const OG_PAGE_DIR = 'og/page';

/**
 * Where scripts/generate-og-images.mjs records each page's image, `{[route]: {file, alt}}`, for
 * the crawl, relative to the repo root: outside dist, so the deploy doesn't serve it.
 */
export const OG_PAGE_MANIFEST = 'apps/web/node_modules/.cache/og-pages.json';

/** The app files the parsers read, relative to the repo root. */
export const PLAYSTYLE_UI_FILE = 'apps/web/src/shared/constants/playstyleUi.ts';
export const REVEAL_SET_FILE = 'apps/web/src/shared/constants/revealSet.ts';

/** How many cards a fan shows: the gallery tile's hero and four more. */
const FAN_SIZE = 5;

/** How many cards the playstyle image names under "Key cards". */
const KEY_CARDS = 3;

const HOME_ALT = 'Inkweave: find the Lorcana cards that work together';

/**
 * The key an image of `route` is named by, and so the image a captured page must name: its own
 * for the home page, a playstyle page and /reveals, the home image for every other page.
 */
export function pageOgKey(route) {
  if (route === '/reveals') return 'reveals';
  const playstyle = route.match(/^\/playstyles\/([a-z0-9-]+)$/)?.[1];
  return playstyle ? `playstyle-${playstyle}` : 'home';
}

// One PLAYSTYLE_UI entry: `bounce: makeUiMeta('#8b5cf6', 'mechanic', '2500'),`, its id quoted
// when it holds a hyphen.
const UI_ENTRY = /^\s*'?([a-z][a-z0-9-]*)'?:\s*makeUiMeta\(\s*'(#[0-9a-fA-F]{6})',\s*'[a-z]+',\s*'(\d+)'\s*\)/gm;

/** Each playstyle's `{accent, heroId}`, read from playstyleUi.ts's text. */
export function parsePlaystyleUi(text) {
  const entries = [...text.matchAll(UI_ENTRY)];
  return Object.fromEntries(entries.map(([, id, accent, heroId]) => [id, {accent, heroId}]));
}

/**
 * The reveal set's code and its size, the sum of PER_INK, read from revealSet.ts's text. Throws
 * when either is missing, so no image claims a total the reveals page doesn't show.
 */
export function parseRevealSet(text) {
  const code = text.match(/export const REVEAL_SET_CODE = '(\d+)'/)?.[1];
  const perInk = text.match(/export const PER_INK\b[^=]*=\s*\{([^}]*)\}/)?.[1] ?? '';
  const counts = [...perInk.matchAll(/:\s*(\d+)/g)].map(([, count]) => Number(count));
  if (!code || counts.length === 0) throw new Error(`${REVEAL_SET_FILE}: no REVEAL_SET_CODE or PER_INK`);
  return {code, total: counts.reduce((sum, count) => sum + count, 0)};
}

/**
 * The code of the set in reveal season, or null: one in previewCards.json whose release date is
 * still ahead. The crawl captures /reveals only then (isRevealSeasonActive in prerender.mjs);
 * the rest of the year the route redirects home.
 */
export function revealSeasonSet(preview, now = new Date()) {
  const inSeason = ([, set]) => set?.releaseDate && new Date(set.releaseDate) > now;
  return Object.entries(preview?.sets ?? {}).find(inSeason)?.[0] ?? null;
}

/** A card a fan can show: one with art, and not a Location, whose art lies sideways. */
const fannable = (card) => Boolean(card?.imageHash) && card.type !== 'Location';

const artSrc = (card) => artOf(card).src;

/**
 * The home image, which every page without its own shows too: the featured cards, one per ink.
 * `featuredIds` are data/featuredCards.json's, whose cards carry no image hash, so their art
 * comes from `cardsById`.
 */
export function homeOgData(featuredIds, cardsById) {
  const cards = featuredIds.map((id) => cardsById.get(String(id))).filter((card) => card?.imageHash);
  return {
    route: '/',
    kind: 'home',
    alt: HOME_ALT,
    data: {cards: cards.map((card) => ({src: artSrc(card), ink: inkGlow(card)}))},
  };
}

const byFullName = (a, b) => a.fullName.localeCompare(b.fullName);

/**
 * A playstyle page's image, or null when none of its cards can be drawn. The fan is the
 * gallery tile's (PlaystyleGalleryPage's fanCardsFor): the hero, then the playstyle's cards by
 * full name, leaving out what a fan can't show.
 *
 * @param {object} page
 * @param {{id: string, name: string, tagline: string}} page.playstyle - from the engine's catalog
 * @param {string[]} page.memberIds - its cards, from data/synergies/_playstyles.json
 * @param {{accent: string, heroId: string}} page.ui - its PLAYSTYLE_UI entry
 * @param {Map<string, object>} page.cardsById - every card, by id as a string
 */
export function playstyleOgData({playstyle, memberIds, ui, cardsById}) {
  const members = memberIds.map((id) => cardsById.get(String(id))).filter(Boolean).sort(byFullName);
  const hero = cardsById.get(ui.heroId) ?? members[0];
  const fan = [hero, ...members.filter((card) => card !== hero)].filter(fannable).slice(0, FAN_SIZE);
  if (fan.length === 0) return null;
  const keys = [...new Set(fan.map((card) => card.name))].slice(0, KEY_CARDS);
  return {
    route: `/playstyles/${playstyle.id}`,
    kind: 'playstyle',
    alt: `${playstyle.name} Lorcana playstyle on Inkweave, with ${fan[0].fullName} and more of its cards`,
    data: {
      glow: ui.accent,
      kicker: `Lorcana playstyle · ${members.length} cards`,
      title: playstyle.name,
      sub: playstyle.tagline,
      keys: keys.join(' · '),
      cards: fan.map(artSrc),
    },
  };
}

/**
 * /reveals' image: the set, how many of its cards are out of its total, and the newest ones,
 * newest first. `revealed` is the set's revealed cards in the order they were added, the order
 * previewCards.json keeps them in.
 *
 * @param {object[]} revealed
 * @param {{code: string, name: string, total: number}} set
 */
export function revealsOgData(revealed, {code, name, total}) {
  const count = revealed.length;
  return {
    route: '/reveals',
    kind: 'reveals',
    alt: `${name} reveals on Inkweave: ${count} of ${total} cards revealed`,
    data: {
      kicker: `Set ${code} reveals`,
      title: name,
      sub: `${count} of ${total} cards revealed`,
      progress: Math.min(1, count / total),
      cards: revealed.filter(fannable).slice(-FAN_SIZE).reverse().map(artSrc),
    },
  };
}

/** The image's absolute URL, as og:image needs it. */
const pageOgImageUrl = (fileName) => `${SITE_ORIGIN}/${OG_PAGE_DIR}/${fileName}`;

/** Each page's image, `{url, alt}`, by route, from the record the generator saved. */
export function pageOgImagesByRoute(record) {
  return new Map(
    Object.entries(record).map(([route, {file, alt}]) => [route, {url: pageOgImageUrl(file), alt}]),
  );
}

/**
 * The image the crawl writes into `route`'s page: a card page's own, a page's own, or the home
 * image. Undefined only when the home image wasn't drawn, so the page keeps index.html's banner.
 *
 * @param {string} route
 * @param {{cards: Map<string, object>, pages: Map<string, object>}} images - by route
 */
export function ogImageForRoute(route, {cards, pages}) {
  return cards.get(route) ?? pages.get(route) ?? pages.get('/');
}
