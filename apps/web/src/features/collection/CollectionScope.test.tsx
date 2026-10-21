import {describe, expect, it, vi} from 'vitest';
import {render, screen} from '@testing-library/react';
import {createMemoryRouter, RouterProvider} from 'react-router-dom';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {createCard} from '../../shared/test-utils';
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

vi.mock('../../shared/contexts/CardDataContext', () => ({
  useCardDataContext: () => ({cards: [MOTHER]}),
}));
vi.mock('../../shared/contexts/SessionContext', () => ({
  useSession: () => ({user: null, loading: false}),
}));

/** The copies a page under the scope sees. */
function Shown() {
  return <output>{JSON.stringify(useCollection().entries)}</output>;
}

describe('CollectionScope', () => {
  it('shows each copy where it belongs among the printings the card data holds, saved as counted (#880)', async () => {
    localStorage.clear();
    // A foil copy counted on 1/C3, which comes in normal alone.
    const counted = {'80017': {normal: 0, foil: 1}};
    writeCollection(counted, 5000, null, 'import');
    const router = createMemoryRouter([
      {element: <CollectionScope />, children: [{index: true, element: <Shown />}]},
    ]);
    render(<RouterProvider router={router} />);

    const shown = await screen.findByRole('status');
    expect(JSON.parse(shown.textContent ?? '')).toEqual({'80024': {normal: 0, foil: 1}});
    expect(readCollection()?.entries).toEqual(counted);
  });
});
