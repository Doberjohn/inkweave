import {afterEach, beforeEach, describe, expect, it, vi, type Mock} from 'vitest';
import {isCoreSet} from 'inkweave-synergy-engine/card';
import {COLLECTION_SETS} from './collectionChunks';

// The loads are kept at module level for the visit, so each test loads a fresh copy.
async function freshChunks() {
  vi.resetModules();
  return import('./collectionChunks');
}

const url = (file: string) => `/data/collection/${file}.json`;
// Split by the engine's own test for Core, so the loader's listed stages follow Core's floor.
const PRE_CORE_FILES = [...COLLECTION_SETS.filter((set) => !isCoreSet(set)), 'promos'].map(url);
const CORE_SET_FILES = COLLECTION_SETS.filter((set) => isCoreSet(set)).map(url);

describe('collectionChunks', () => {
  let fetchMock: Mock;
  const requested = () => fetchMock.mock.calls.map(([requestUrl]) => requestUrl as string);

  beforeEach(() => {
    fetchMock = vi.fn(() => Promise.resolve({ok: true, json: () => Promise.resolve([])}));
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads sets 1-8 and the promos once, however many ask, and never sets 9-14', async () => {
    const {loadPreCoreSets} = await freshChunks();

    await Promise.all([loadPreCoreSets(), loadPreCoreSets()]);
    await loadPreCoreSets();

    expect(requested().sort()).toEqual([...PRE_CORE_FILES].sort());
  });

  it('loads sets 9-14 apart, for collection mode alone', async () => {
    const {loadCoreSetChunks} = await freshChunks();

    await loadCoreSetChunks();

    expect(requested().sort()).toEqual([...CORE_SET_FILES].sort());
  });

  it('forgets a failed load, so the next ask fetches again', async () => {
    const {loadPreCoreSets} = await freshChunks();
    fetchMock.mockImplementationOnce(() => Promise.resolve({ok: false, status: 503}));

    await expect(loadPreCoreSets()).rejects.toThrow('HTTP 503');
    fetchMock.mockClear();
    await loadPreCoreSets();

    expect(requested()).toHaveLength(PRE_CORE_FILES.length);
  });

  it("gives Browse's search each sets 1-8 card with its printings, and leaves the printings out (#911)", async () => {
    // Hiro Hamada - Armor Designer (7/96) and his Enchanted (7/214) as Set 7's chunk holds
    // them, and his 24A/P2 promo as collection/promos.json lists it.
    const hiro = {
      id: 1529,
      name: 'Hiro Hamada',
      version: 'Armor Designer',
      fullName: 'Hiro Hamada - Armor Designer',
      cost: 7,
      color: 'Emerald-Sapphire',
      inkwell: true,
      type: 'Character',
      setCode: '7',
      number: 96,
      rarity: 'Super Rare',
    };
    const enchanted = {...hiro, id: 1647, number: 214, rarity: 'Enchanted', baseId: 1529};
    const promo = {id: 1661, rarity: 'Special', number: 24, promoGrouping: 'P2', fullName: hiro.fullName, baseId: 1529};
    const served: Record<string, unknown[]> = {[url('7')]: [hiro, enchanted], [url('promos')]: [promo]};
    fetchMock.mockImplementation((requestUrl: string) =>
      Promise.resolve({ok: true, json: () => Promise.resolve(served[requestUrl] ?? [])}),
    );
    const {loadPreCoreSearchCards} = await freshChunks();

    const cards = await loadPreCoreSearchCards();

    expect(cards.map((card) => card.id)).toEqual(['1529']);
    expect(cards[0].variants?.map((printing) => printing.id)).toEqual(['1647', '1661']);
  });
});
