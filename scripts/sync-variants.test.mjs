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

function run({previewAvifExists = () => false, previewCards = [mickey()]} = {}) {
  const allData = {cards: [pongo()]};
  const previewData = {cards: previewCards};
  const report = syncVariants({allData, previewData, source, season: SEASON, previewAvifExists});
  return {allData, previewData, report};
}

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

  it('reports nothing for previewCards once the reveal set has graduated and it is empty', () => {
    const {report} = run({previewCards: []});
    expect(report.preview.unmatched).toEqual([]);
  });

  it('flags a manual scan AVIF that would shadow newly synced official art', () => {
    const {report} = run({previewAvifExists: (id) => id === 14241});
    expect(report.shadowed).toEqual([14241]);
  });
});
