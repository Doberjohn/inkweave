import type {SpotlightHeroData} from './SpotlightHero';
import {FRANCHISES, type FranchiseConfig, type FranchiseId} from './franchise';
import {INK_COLORS, PLAYSTYLE_UI} from '../../shared/constants';

/** A reveal-set spotlight, rendered as a SpotlightHero card in the What's New band. */
export interface Spotlight extends SpotlightHeroData {
  id: string;
}

export interface SpotlightGroup {
  /** Small uppercase label above the sub-group. */
  eyebrow: string;
  items: Spotlight[];
}

/**
 * Spotlight art by file name: a copy of a revealed card's full-size AVIF, kept under
 * public/art/spotlights/ and named after the card. Not a card id, because graduation
 * renumbers the set's cards and its preview AVIFs go with them.
 */
const art = (name: string): string => `/art/spotlights/${name}.avif`;

/**
 * Curated spotlights for the reveal set: its new mechanics and tribes, each a
 * hero card plus a small fan of supporting cards. Per-season content, and empty
 * until the set's mechanics are actually revealed: WhatsNewSection drops a group
 * with no items, so the band shows the debut franchises alone in the meantime.
 *
 * To add one, give it an `id`, an `accent` token (a playstyle's PLAYSTYLE_UI
 * accent, or an INK_COLORS border), and `art()` names of revealed cards' art,
 * copied into public/art/spotlights/.
 */
export const SET_SPOTLIGHTS: SpotlightGroup[] = [
  {
    eyebrow: 'Mechanics',
    items: [
      {
        id: 'ink-drops',
        accent: PLAYSTYLE_UI['ink-drops'].accentColor,
        isNew: true,
        count: 'New mechanic',
        title: 'Ink Drops',
        summary: 'Bank ink drops now and spend them later. Each one pays 1 ink.',
        href: '/playstyles/ink-drops',
        heroImage: art('arthur-jousting-knight'),
        heroAlt: 'Arthur - Jousting Knight',
        support: [
          {src: art('merlin-ink-drop-tinkerer'), alt: 'Merlin - Ink Drop Tinkerer'},
          {src: art('madam-mim-resourceful-trickster'), alt: 'Madam Mim - Resourceful Trickster'},
          {src: art('baymax-amped-up'), alt: 'Baymax - Amped Up'},
        ],
      },
    ],
  },
];

/**
 * Representative hero + fan card art for a debut franchise, by `art()` name.
 * Optional: a franchise with no revealed cards yet falls back to its logo.
 */
const FRANCHISE_ART: Partial<Record<FranchiseId, {hero: string; support: string[]}>> = {
  // Fan nearest first. Portrait art only: the fan crops to cover.
  coco: {
    hero: 'miguel-rivera-street-musician',
    support: ['hector-rivera-street-musician', 'pepita-imeldas-right-hand', 'un-poco-loco'],
  },
};

/**
 * Build a SpotlightHero card for a debut franchise. The accent is the franchise's
 * curated ink, so its What's New card and its cards modal share one colour;
 * clicking opens the cards modal rather than linking to a playstyle page.
 */
export function franchiseSpotlight(f: FranchiseConfig): SpotlightHeroData {
  const cardArt = FRANCHISE_ART[f.id];
  return {
    accent: INK_COLORS[f.ink].border,
    isNew: true,
    count: 'New franchise',
    title: f.label,
    summary: f.blurb,
    cta: 'View cards →',
    heroImage: cardArt ? art(cardArt.hero) : `/art/franchises/${f.id}.webp`,
    // A logo is a wide wordmark, not a card: fit it inside the card frame instead of cropping.
    heroFit: cardArt ? 'cover' : 'contain',
    heroAlt: f.label,
    support: (cardArt?.support ?? []).map((name) => ({src: art(name), alt: f.label})),
  };
}

/** The debut-franchise spotlight cards, paired with their config for the modal. */
export const FRANCHISE_SPOTLIGHTS: {config: FranchiseConfig; data: SpotlightHeroData}[] = FRANCHISES.map((f) => ({
  config: f,
  data: franchiseSpotlight(f),
}));
