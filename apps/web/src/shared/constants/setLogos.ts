/**
 * Each set's logo art: small WebPs in `public/art/sets/`, 112px tall (2x for the
 * 56px boxes they show in). Read by the Set filter's logo tiles and the collection
 * set panel's header; a set without one falls back to its name in both.
 * Hyperia City's is the reveal promo's 320px copy, named here rather than read from
 * `REVEAL_SET_LOGO_SM`: the reveal runbook points that constant at each new set, which
 * would have given Set 14 the next set's logo.
 */
export const SET_LOGOS: Partial<Record<string, string>> = {
  '1': '/art/sets/the-first-chapter.webp',
  '2': '/art/sets/rise-of-the-floodborn.webp',
  '3': '/art/sets/into-the-inklands.webp',
  '4': '/art/sets/ursulas-return.webp',
  '5': '/art/sets/shimmering-skies.webp',
  '6': '/art/sets/azurite-sea.webp',
  '7': '/art/sets/archazias-island.webp',
  '8': '/art/sets/the-reign-of-jafar.webp',
  '9': '/art/sets/fabled.webp',
  '10': '/art/sets/whispers-in-the-well.webp',
  '11': '/art/sets/winterspell.webp',
  '12': '/art/sets/wilds-unknown.webp',
  '13': '/art/sets/attack-of-the-vine.webp',
  '14': '/art/sets/hyperia-city-sm.webp',
  // Unreleased: no cards yet, so nothing offers it until they land.
  '15': '/art/sets/into-the-inkdark.webp',
};
