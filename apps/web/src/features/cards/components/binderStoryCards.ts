import type {LorcanaCard} from '../types';

/**
 * Story-only fixture for the binder components. A `.ts` file, so the
 * story-coverage gate skips it (it scans `.tsx` only) and it never reads as a
 * component missing a story.
 *
 * NO `imageUrl`, deliberately. The binder always renders tiles with
 * `useSmallImage`, and outside a production build `smallImageUrl` derives the
 * `-sm` path from `imageUrl` by string surgery — which cannot match the
 * separately-hashed small variant, so a real-looking path would 404 anyway.
 * Worse, the hashes are not reproducible: measured on this repo, card 1937 is
 * `866a4c3b93589e44` in the committed JSON and `0a93ea0f5185d084` on disk,
 * because AVIF re-encodes differ per machine. Any hash baked in here would be a
 * lie on someone else's checkout.
 *
 * With no `imageUrl`, `CardTile` takes its clean fallback branch immediately —
 * the ink-tinted cost badge, no network request, identical everywhere. It also
 * makes each card's INK visible at a glance, which is what these stories are
 * for: judging the spread, the gutter and the fill, not the artwork.
 *
 * Names and inks are real Set 9 cards in collector order, so the ink runs are
 * the genuine ones a binder page would show.
 *
 * WHAT THESE STORIES THEREFORE CANNOT JUDGE: anything overlaying a tile against
 * real artwork. The fallback is a flat, dark, ink-tinted rectangle, so a
 * semi-transparent chrome element looks solid here and dissolves in the app —
 * which is exactly how a 30%-opaque foil badge with no ground under it passed a
 * screenshot review. Chrome that sits ON a card must be checked for its own
 * opaque ground by reading the CSS, not by looking at these.
 */
const SET_9: ReadonlyArray<[number, string, LorcanaCard['ink'], number]> = [
  [1936, 'Bruno Madrigal - Undetected Uncle', 'Amethyst', 4],
  [1937, 'The Queen - Conceited Ruler', 'Amber', 3],
  [1938, 'Pongo - Determined Father', 'Amber', 3],
  [1939, 'Stitch - Rock Star', 'Amber', 6],
  [1940, 'Beast - Gracious Prince', 'Amber', 5],
  [1941, 'Minnie Mouse - Sweetheart Princess', 'Amber', 4],
  [1942, 'Aurora - Holding Court', 'Amber', 1],
  [1943, 'The Queen - Regal Monarch', 'Amber', 1],
  [1944, 'Rapunzel - Sunshine', 'Amber', 2],
  [1945, 'Stitch - Alien Dancer', 'Amber', 2],
  [1946, 'Mulan - Free Spirit', 'Amber', 3],
  [1947, 'Daisy Duck - Musketeer Spy', 'Amber', 4],
  [1948, 'Tinker Bell - Generous Fairy', 'Amber', 4],
  [1949, 'Mickey Mouse - True Friend', 'Amber', 3],
  [1950, 'Pluto - Determined Defender', 'Amber', 7],
  [1951, 'Ariel - Singing Mermaid', 'Amber', 4],
  [1952, 'Pluto - Rescue Dog', 'Amber', 5],
  [1953, 'Nani - Protective Sister', 'Amber', 5],
  [1954, 'Julieta Madrigal - Excellent Cook', 'Amber', 3],
  [1955, 'Cinderella - Gentle and Kind', 'Amber', 4],
  [1956, 'Moana - Of Motunui', 'Amber', 5],
  [1957, 'Pluto - Friendly Pooch', 'Amber', 1],
  [1958, 'Ursula - Vanessa', 'Amber', 2],
  [1959, 'Queen of Hearts - Wonderland Empress', 'Amber', 3],
  [1960, 'Stitch - Carefree Surfer', 'Amber', 7],
  [1961, 'Look at This Family', 'Amber', 7],
];

function toCard([id, fullName, ink, cost]: (typeof SET_9)[number], index: number): LorcanaCard {
  return {
    id: String(id),
    name: fullName.split(' - ')[0],
    version: fullName.split(' - ')[1],
    fullName,
    cost,
    ink,
    inkwell: cost % 3 !== 0,
    type: fullName.includes(' - ') ? 'Character' : 'Action',
    setCode: '9',
    setNumber: index,
    rarity: 'Common',
  };
}

/** 26 cards: more than one spread of 24, so paging has somewhere to go. */
export const BINDER_CARDS: LorcanaCard[] = SET_9.map(toCard);

/** Exactly one full spread. */
export const ONE_SPREAD: LorcanaCard[] = BINDER_CARDS.slice(0, 24);

/** Seven cards — a third of a page, for the trailing-spread empty-pocket case. */
export const PARTIAL_SPREAD: LorcanaCard[] = BINDER_CARDS.slice(0, 7);
