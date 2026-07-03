import type {SpotlightHeroData} from './SpotlightHero';
import {FRANCHISES, type FranchiseConfig, type FranchiseId} from './franchise';
import {INK_COLORS} from '../../shared/constants';
import {PLAYSTYLE_UI} from '../../shared/constants/playstyleUi';

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
        heroImage: art(13197),
        heroAlt: 'The Vine - Towering Stalk',
        support: [
          {src: art(13115), alt: 'Gaston - Created by the Vine'},
          {src: art(13026), alt: 'Ursula - Created by the Vine'},
          {src: art(13192), alt: 'Mulan - Created by the Vine'},
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
        heroImage: art(13132),
        heroAlt: 'Belle & Beast - Certain as the Sun',
        support: [
          {src: art(13031), alt: 'Lilo & Stitch - Fun-Loving Friends'},
          {src: art(13028), alt: 'Woody & Buzz Lightyear - Best Buddies'},
          {src: art(13099), alt: 'Mickey Mouse & Minnie Mouse - Adventuring Duo'},
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
        heroImage: art(13125),
        heroAlt: 'Meilin Lee - Popular Red Panda',
        support: [
          {src: art(13044), alt: 'Meilin Lee - Superficially Obedient'},
          {src: art(13049), alt: 'Ming Lee - Overprotective Parent'},
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
        heroImage: art(13119),
        heroAlt: 'Sun Yee - Soul of the Red Panda',
        support: [
          {src: art(13007), alt: 'Meilin Lee - Lead Vocalist'},
          {src: art(13002), alt: 'Ming Lee - Proud Parent'},
          {src: art(13129), alt: 'Ming Lee - Giant Red Panda'},
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
        heroImage: art(13040),
        heroAlt: 'Winnie the Pooh - Hunny Archmage',
        support: [
          {src: art(13126), alt: 'Tigger - Hunny Barbarian'},
          {src: art(13083), alt: 'Roo - Hunny Rogue'},
          {src: art(13061), alt: 'Christopher Robin - Hunny Sage'},
        ],
      },
    ],
  },
];

/** Representative hero + fan card art for each debut franchise. */
const FRANCHISE_ART: Record<FranchiseId, {hero: number; support: number[]; accent: string}> = {
  'monsters-inc': {hero: 13024, support: [13021, 13127, 13123], accent: INK_COLORS.Amber.border},
  up: {hero: 13079, support: [13113, 13088, 13075], accent: INK_COLORS.Emerald.border},
  'turning-red': {hero: 13007, support: [13009, 13017, 13033], accent: INK_COLORS.Ruby.border},
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
