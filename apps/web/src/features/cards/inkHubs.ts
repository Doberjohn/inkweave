import type {Ink, LorcanaCard} from 'inkweave-synergy-engine';

/**
 * The six ink hub pages (#530).
 *
 * Ink is the only TOTAL partition of the card corpus: every card carries at least one, so
 * six pages guarantee every one of the 1,024 cards an inbound internal link. Playstyles
 * reach only 682 cards and synergy adjacency truncates at `maxVisibleCards`, so neither
 * can close the orphan gap on its own.
 *
 * Set pages would partition the corpus too, but sets 9 and 13 hold 205 and 207 cards
 * against `LAYOUT.maxDisplayedCards = 204` — they would silently truncate, producing hubs
 * that look complete while hiding cards. Every ink hub is 173-174, so there is roughly a
 * set's worth of headroom before that becomes a concern here.
 */
export interface InkHub {
  /** URL segment: /ink/{slug}. Lowercased ink name; never derive it from user input. */
  slug: string;
  ink: Ink;
}

/**
 * Keyed by `Ink` rather than declared as a bare array so the compiler enforces
 * exhaustiveness: if the engine's `Ink` union ever gains a colour, this object fails to
 * typecheck instead of silently shipping a hub that no page links to and no card reaches.
 *
 * Every factual claim below was verified against allCards.json rather than written from
 * memory. Two claims in the original #530 draft were wrong and are corrected here:
 * Support concentrates in Sapphire (15) not Amber (11), and Bodyguard concentrates in
 * Amber (13) not Steel (10). Re-verify before editing — these pages target players who
 * will notice.
 */
const HUB_BY_INK: Record<Ink, InkHub> = {
  Amber: {
    slug: 'amber',
    ink: 'Amber',
  },
  Amethyst: {
    slug: 'amethyst',
    ink: 'Amethyst',
  },
  Emerald: {
    slug: 'emerald',
    ink: 'Emerald',
  },
  Ruby: {
    slug: 'ruby',
    ink: 'Ruby',
  },
  Sapphire: {
    slug: 'sapphire',
    ink: 'Sapphire',
  },
  Steel: {
    slug: 'steel',
    ink: 'Steel',
  },
};

/**
 * Editorial copy, split from the hub list ON PURPOSE (#530).
 *
 * `Footer` lives in the MAIN bundle and imports INK_HUBS for six link labels. When the
 * blurbs lived on those same objects, ~1.8 kB of prose that only two lazy pages ever
 * render was pulled into every page load. Keeping them in a separate record lets the
 * bundler drop them from the main chunk — which mattered: the PR that added these pages
 * landed the total JS bundle within 936 bytes of its 375 kB ceiling.
 *
 * Every factual claim below was verified against allCards.json rather than written from
 * memory. Two claims in the original #530 draft were wrong and are corrected here:
 * Support concentrates in Sapphire (15) not Amber (11), and Bodyguard in Amber (13) not
 * Steel (10). Re-verify before editing — these pages target players who will notice.
 */
export const INK_HUB_BLURBS: Record<Ink, string> = {
  Amber:
    "Amber protects and sustains. It holds the format's densest cluster of Bodyguard characters alongside its Singers, and leads on Sing Together, so Amber decks tend to stall the board, heal back damage, and convert songs into tempo.",
  Amethyst:
    'Amethyst pressures through the air. Evasive is its most common keyword by some margin, backed by Rush and Challenger, giving it characters that get in early and keep questing while the opponent struggles to block.',
  Emerald:
    "Emerald evades and protects what it plays. It pairs the format's highest Evasive count with heavy Ward, so its threats are both hard to block and hard to remove once they land.",
  Ruby: 'Ruby is the aggressive ink. Reckless and Rush push its characters into combat on the turn they arrive, and its Evasive count keeps the pressure on when the board stalls.',
  Sapphire:
    "Sapphire builds advantage before it attacks. Support and Ward concentrate here, and it carries the format's item density — the ink that ramps, draws and sets up rather than racing.",
  Steel:
    "Steel wins the ground. Resist clusters here far more than in any other ink, paired with the format's highest Challenger count to trade up, producing bodies that survive removal and hold the board.",
};

/** Alphabetical by ink — the order the gallery and footer render. */
export const INK_HUBS: readonly InkHub[] = [
  HUB_BY_INK.Amber,
  HUB_BY_INK.Amethyst,
  HUB_BY_INK.Emerald,
  HUB_BY_INK.Ruby,
  HUB_BY_INK.Sapphire,
  HUB_BY_INK.Steel,
];

/** Resolve a URL slug to its hub. Returns undefined for unknown slugs, so the route 404s. */
export function getInkHub(slug: string | undefined): InkHub | undefined {
  return INK_HUBS.find((hub) => hub.slug === slug);
}

/**
 * Cards belonging to an ink hub.
 *
 * Dual-ink cards appear on BOTH their hubs — the same either-ink rule the deck-compat and
 * filter paths already use. That is what makes the partition total: 1,024 cards produce
 * 1,040 hub slots because 16 dual-ink cards are counted twice.
 */
export function cardsForInk(cards: readonly LorcanaCard[], ink: Ink): LorcanaCard[] {
  return cards.filter((card) => card.ink === ink || card.ink2 === ink);
}
