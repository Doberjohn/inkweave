import {describe, it, expect} from 'vitest';
import {syncVariants} from './sync-variants.mjs';

const SEASON = {setCode: '14', idBase: 14000};
const IMAGES = {full: 'full.jpg', thumbnail: 'thumb.jpg'};

const pongo = () => ({id: 1938, setCode: '9', number: 2, fullName: 'Pongo - Determined Father'});
const mickey = () => ({
  id: 14023,
  setCode: '14',
  number: 23,
  fullName: 'Mickey Mouse - Best in Town',
});

const source = [
  {
    id: 2141,
    baseId: 1938,
    setCode: '9',
    number: 223,
    fullName: 'Pongo - Determined Father',
    rarity: 'Enchanted',
    images: IMAGES,
  },
  {
    id: 3506,
    baseId: 3288,
    setCode: '14',
    number: 241,
    fullName: 'Mickey Mouse - Best in Town',
    rarity: 'Iconic',
    images: IMAGES,
  },
  // A pre-Core printing: its base is in no file we sync.
  {
    id: 900,
    baseId: 800,
    setCode: '3',
    number: 210,
    fullName: 'Old Card - Long Gone',
    rarity: 'Enchanted',
    images: IMAGES,
  },
];

function run({previewAvifExists = () => false, previewCards = [mickey()], from = source} = {}) {
  const allData = {cards: [pongo()]};
  const previewData = {cards: previewCards};
  const report = syncVariants({
    allData,
    previewData,
    source: from,
    season: SEASON,
    previewAvifExists,
  });
  return {allData, previewData, report};
}

/**
 * Violet Parr - Super Resilient and her #247, which keeps her Super Rare rarity but comes in foil
 * alone: the kind of printing the app's rarity rule gets wrong (#880).
 */
const violet = (variants) => ({
  id: 3147,
  setCode: '13',
  number: 176,
  fullName: 'Violet Parr - Super Resilient',
  ...(variants && {variants}),
});
const violetFoil = (foilTypes) => ({
  id: 3573,
  baseId: 3147,
  setCode: '13',
  number: 247,
  fullName: 'Violet Parr - Super Resilient',
  rarity: 'Super Rare',
  images: IMAGES,
  ...(foilTypes && {foilTypes}),
});

/** The source with each printing's `foilTypes` as LorcanaJSON lists them, and Violet's #247 with `violetTypes`. */
const withFoilTypes = (violetTypes) => [
  {...source[0], foilTypes: ['Satin']},
  {...source[1], foilTypes: ['None', 'Cold']},
  source[2],
  violetFoil(violetTypes),
];

/** A sync of allCards.json alone, on `allData` as it stands. */
const syncAll = (allData, from) =>
  syncVariants({
    allData,
    previewData: {cards: []},
    source: from,
    season: SEASON,
    previewAvifExists: () => false,
  });

const lastKey = (entry) => Object.keys(entry).at(-1);

describe('syncVariants', () => {
  it('folds canonical variants into allCards by baseId, keeping LorcanaJSON ids', () => {
    const {allData} = run();
    expect(allData.cards[0].variants).toEqual([
      {id: 2141, rarity: 'Enchanted', number: 223, images: IMAGES},
    ]);
  });

  it('folds reveal-set variants into previewCards by name, with reveal-convention ids', () => {
    const {previewData} = run();
    expect(previewData.cards[0].variants).toEqual([
      {id: 14241, rarity: 'Iconic', number: 241, images: IMAGES},
    ]);
  });

  it('only considers variants from sets the target file holds, so older sets are not reported as unmatched', () => {
    const {report} = run();
    expect(report.canonical.unmatched).toEqual([]);
    expect(report.preview.unmatched).toEqual([]);
  });

  // previewCards folds only the reveal season's set: an earlier set's card there (Pongo, set 9)
  // must not pick up its variant from the source, even though the name would match.
  it("folds only the reveal season's set into previewCards", () => {
    const {report} = run({previewCards: [pongo()]});
    expect(report.preview.folded).toEqual([]);
    expect(report.preview.unmatched).toEqual([]);
  });

  it('flags a manual scan AVIF that would shadow newly synced official art', () => {
    const {report} = run({previewAvifExists: (id) => id === 14241});
    expect(report.shadowed).toEqual([14241]);
  });

  it("gives an allCards printing the versions LorcanaJSON names where its rarity's are wrong, last (#880)", () => {
    const allData = {cards: [pongo(), violet()]};
    syncAll(allData, withFoilTypes(['Cold']));

    const [altFoil] = allData.cards[1].variants;
    expect(altFoil).toEqual({
      id: 3573,
      rarity: 'Super Rare',
      number: 247,
      images: IMAGES,
      finishes: ['foil'],
    });
    expect(lastKey(altFoil)).toBe('finishes');
    // Pongo's Enchanted comes in foil alone, as its rarity says: no field.
    expect(allData.cards[0].variants[0]).not.toHaveProperty('finishes');
  });

  it("gives previewCards' printings no versions until their set is official (#880)", () => {
    // Mickey's Iconic is listed in both, which its rarity's foil alone is not.
    const {previewData} = run({from: withFoilTypes(['Cold'])});
    expect(previewData.cards[0].variants[0]).not.toHaveProperty('finishes');
  });

  it('never changes or removes versions a printing holds already, whatever LorcanaJSON says (#880)', () => {
    // An owner's correction: both versions, where LorcanaJSON lists the foil one alone.
    const corrected = () => ({
      id: 3573,
      rarity: 'Super Rare',
      number: 247,
      images: IMAGES,
      finishes: ['normal', 'foil'],
    });
    const allData = {cards: [violet([corrected()])]};

    expect(syncAll(allData, withFoilTypes(['Cold'])).given).toEqual([]);
    expect(allData.cards[0].variants).toEqual([corrected()]);
    // Nor when LorcanaJSON stops listing any.
    syncAll(allData, withFoilTypes(undefined));
    expect(allData.cards[0].variants[0].finishes).toEqual(['normal', 'foil']);
  });

  it('lists the versions it gave, and a second run gives none and changes no byte (#880)', () => {
    const allData = {cards: [pongo(), violet()]};

    expect(syncAll(allData, withFoilTypes(['Cold'])).given).toEqual([
      {label: '3573 13/247 Super Rare Violet Parr - Super Resilient', finishes: ['foil']},
    ]);
    const written = JSON.stringify(allData, null, 2);
    expect(syncAll(allData, withFoilTypes(['Cold'])).given).toEqual([]);
    expect(JSON.stringify(allData, null, 2)).toBe(written);
  });
});
