import type {ReactNode} from 'react';
import {describe, expect, it, vi} from 'vitest';
import {render, screen} from '@testing-library/react';
import {createMemoryRouter, RouterProvider} from 'react-router-dom';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {createCard} from '../../shared/test-utils';
import type {CollectionEntries} from './collectionParser';
import {useCollection} from './CollectionContext';
import {CollectionScope} from './CollectionScope';
import {readCollection, writeCollection} from './collectionStorage';

/** Mother Knows Best, a Core card: 1/C3 in normal alone, and 13/C3, its foil twin. */
const MOTHER: LorcanaCard = createCard({
  id: '2035',
  rarity: 'Uncommon',
  variants: [
    {id: '80017', rarity: 'Special', number: 1, promoGrouping: 'C3', finishes: ['normal']},
    {id: '80024', rarity: 'Special', number: 13, promoGrouping: 'C3', finishes: ['foil']},
  ],
});

/** A Core card whose variants hold its #243, an alt foil, without naming its finish. */
const SVEN: LorcanaCard = createCard({
  id: '3001',
  rarity: 'Rare',
  variants: [{id: '3570', rarity: 'Super Rare', number: 243}],
});

/** That #243 as its set's collection chunk holds it, in foil alone. */
const SVEN_ALT_FOIL: LorcanaCard = createCard({
  id: '3570',
  setCode: '11',
  rarity: 'Super Rare',
  baseId: '3001',
  finishes: ['foil'],
});

vi.mock('../../shared/contexts/CardDataContext', () => ({
  useCardDataContext: () => ({cards: [MOTHER, SVEN]}),
}));
vi.mock('../../shared/contexts/SessionContext', () => ({
  useSession: () => ({user: null, loading: false}),
}));
// The collection's chunks as once loaded, with no fetch.
vi.mock('./CollectionCardsContext', () => ({
  CollectionCardsProvider: ({children}: {children: ReactNode}) => children,
  useCollectionCards: () => ({cards: [SVEN_ALT_FOIL], promos: []}),
}));

/** The copies a page under the scope sees. */
function Shown() {
  return <output>{JSON.stringify(useCollection().entries)}</output>;
}

/** The copies shown under the scope once `counted` is the saved collection. */
async function shownWhenCounted(counted: CollectionEntries): Promise<unknown> {
  localStorage.clear();
  writeCollection(counted, 5000, null, 'import');
  const router = createMemoryRouter([
    {element: <CollectionScope />, children: [{index: true, element: <Shown />}]},
  ]);
  render(<RouterProvider router={router} />);
  const shown = await screen.findByRole('status');
  return JSON.parse(shown.textContent ?? '');
}

describe('CollectionScope', () => {
  it('shows each copy where it belongs among the printings the card data holds, saved as counted (#880)', async () => {
    // A foil copy counted on 1/C3, which comes in normal alone.
    const counted = {'80017': {normal: 0, foil: 1}};
    expect(await shownWhenCounted(counted)).toEqual({'80024': {normal: 0, foil: 1}});
    expect(readCollection()?.entries).toEqual(counted);
  });

  it("places a printing the collection's chunks hold by the chunk's card, which its pocket is built from", async () => {
    expect(await shownWhenCounted({'3570': {normal: 1, foil: 0}})).toEqual({
      '3570': {normal: 0, foil: 1},
    });
  });
});
