import type {SpotlightHeroData} from './SpotlightHero';
import {FRANCHISES, type FranchiseConfig, type FranchiseId} from './franchise';
import {INK_COLORS, PLAYSTYLE_UI} from '../../shared/constants';

/** A Set 13 spotlight, rendered as a SpotlightHero card in the What's New band. */
export interface Spotlight extends SpotlightHeroData {
  id: string;
}

export interface SpotlightGroup {
  /** Small uppercase label above the sub-group. */
  eyebrow: string;
  items: Spotlight[];
}

const art = (id: number): string => `/card-images-preview/${id}.avif`;

/**
 * Curated Set 13 spotlights: three new mechanics + two tribe spotlights, each a
 * hero card plus a small fan of supporting cards. The three engine playstyles
 * (vinelings/red-panda/hunny) reuse their PLAYSTYLE_UI accent and link to their
 * playstyle page now that the rules ship real synergies.
 *
 * Copy is a first pass in the Set 13 Disney voice (real Lorcana terms, no
 * mechanical jargon) and will be tightened in the broader copy review.
 */
export const SET_SPOTLIGHTS: SpotlightGroup[] = [
  {
    eyebrow: 'New mechanics',
    items: [
      {
        id: 'floodborn',
        accent: PLAYSTYLE_UI.floodborn.accentColor,
        isNew: true,
        count: '8 Vinelings',
        title: 'The Vine & Floodborns',
        summary:
          'The Vine twists your characters into Floodborn Vinelings, then rewards you for flooding the board with them. Strengthen them all at once, and let the vines tighten their grip with every quest and banish.',
        href: '/playstyles/floodborn',
        heroImage: art(3168),
        heroAlt: 'The Vine - Towering Stalk',
        support: [
          {src: art(3086), alt: 'Gaston - Created by the Vine'},
          {src: art(2997), alt: 'Ursula - Created by the Vine'},
          {src: art(3163), alt: 'Mulan - Created by the Vine'},
        ],
      },
      {
        id: 'team',
        accent: INK_COLORS.Ruby.border,
        accentGradient: {from: INK_COLORS.Ruby.border, to: INK_COLORS.Sapphire.border},
        isNew: true,
        count: '11 Team cards',
        title: 'Team Characters',
        summary:
          'Beloved pairs arrive as a single card, ready to Shift onto either partner already in play. Two names, two inks, one unbreakable bond.',
        heroImage: art(3103),
        heroAlt: 'Belle & Beast - Certain as the Sun',
        support: [
          {src: art(3002), alt: 'Lilo & Stitch - Fun-Loving Friends'},
          {src: art(2999), alt: 'Woody & Buzz Lightyear - Best Buddies'},
          {src: art(3070), alt: 'Mickey Mouse & Minnie Mouse - Adventuring Duo'},
        ],
      },
      {
        id: 'temporary-shift',
        accent: '#f43f5e',
        isNew: true,
        count: 'New keyword',
        title: 'Temporary Shift',
        summary:
          'A fleeting transformation. Shift in for a single turn, make your move, then slip back to hand with every bit of damage washed away.',
        heroImage: art(3096),
        heroAlt: 'Meilin Lee - Popular Red Panda',
        support: [
          {src: art(3015), alt: 'Meilin Lee - Superficially Obedient'},
          {src: art(3020), alt: 'Ming Lee - Overprotective Parent'},
        ],
      },
    ],
  },
  {
    eyebrow: 'Tribe spotlights',
    items: [
      {
        id: 'red-panda',
        accent: PLAYSTYLE_UI['red-panda'].accentColor,
        isNew: true,
        count: '8 cards',
        title: 'Red Panda',
        summary:
          'Turning Red joins the fight. Dig through your deck to gather the Lee family, and the more Red Pandas you bring out, the stronger the whole pack becomes.',
        href: '/playstyles/red-panda',
        heroImage: art(3090),
        heroAlt: 'Sun Yee - Soul of the Red Panda',
        support: [
          {src: art(2978), alt: 'Meilin Lee - Lead Vocalist'},
          {src: art(2973), alt: 'Ming Lee - Proud Parent'},
          {src: art(3100), alt: 'Ming Lee - Giant Red Panda'},
        ],
      },
      {
        id: 'hunny',
        accent: INK_COLORS.Amethyst.border,
        isNew: false,
        count: '11 cards',
        title: 'Hunny',
        summary:
          'Winnie the Pooh and friends set out as a brave adventuring party. Search out your fellow Hunny, gather the gang, and grow stronger with every friend at your side.',
        href: '/playstyles/hunny',
        heroImage: art(3011),
        heroAlt: 'Winnie the Pooh - Hunny Archmage',
        support: [
          {src: art(3097), alt: 'Tigger - Hunny Barbarian'},
          {src: art(3054), alt: 'Roo - Hunny Rogue'},
          {src: art(3032), alt: 'Christopher Robin - Hunny Sage'},
        ],
      },
    ],
  },
];

/** Representative hero + fan card art for each debut franchise. */
const FRANCHISE_ART: Record<FranchiseId, {hero: number; support: number[]; accent: string}> = {
  'monsters-inc': {hero: 2995, support: [2992, 3098, 3094], accent: INK_COLORS.Amber.border},
  up: {hero: 3050, support: [3084, 3059, 3046], accent: INK_COLORS.Emerald.border},
  'turning-red': {hero: 2978, support: [2980, 2988, 3004], accent: INK_COLORS.Ruby.border},
};

/**
 * Build a SpotlightHero card for a debut franchise (Monsters Inc / Up / Turning
 * Red). Accent comes from the franchise's curated ink; clicking opens its cards
 * modal rather than linking to a playstyle page.
 */
export function franchiseSpotlight(f: FranchiseConfig): SpotlightHeroData {
  const a = FRANCHISE_ART[f.id];
  return {
    accent: a.accent,
    isNew: true,
    count: 'New franchise',
    title: f.label,
    summary: f.blurb,
    cta: 'View cards →',
    heroImage: art(a.hero),
    heroAlt: f.label,
    support: a.support.map((id) => ({src: art(id), alt: f.label})),
  };
}

/** The three debut-franchise spotlight cards, paired with their config for the modal. */
export const FRANCHISE_SPOTLIGHTS: {config: FranchiseConfig; data: SpotlightHeroData}[] = FRANCHISES.map((f) => ({
  config: f,
  data: franchiseSpotlight(f),
}));
