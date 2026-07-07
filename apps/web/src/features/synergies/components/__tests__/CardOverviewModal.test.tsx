import {render, screen} from '@testing-library/react';
import {test, expect} from 'vitest';
import userEvent from '@testing-library/user-event';
import {MemoryRouter} from 'react-router-dom';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import type {SynergyGroup as SynergyGroupData} from '../../types';
import {CardOverviewModal} from '../CardOverviewModal';
import {CardDataProvider} from '../../../../shared/contexts/CardDataContext';

function makeCard(id: string): LorcanaCard {
  return {
    id, name: `Card ${id}`, fullName: `Card ${id} - Test`, version: 'Test',
    ink: 'Amber', type: 'Character', cost: 3, inkwell: true, rarity: 'Common',
    set: 5, number: 1, strength: 2, willpower: 3, lore: 1, textSections: [],
  } as unknown as LorcanaCard;
}

function makeGroup(groupKey: string, label: string, count: number): SynergyGroupData {
  return {
    groupKey, category: 'playstyle', label, tagline: `${label} tagline`,
    description: `${label} description`,
    synergies: Array.from({length: count}, (_, i) => ({
      card: makeCard(`syn-${i}`), score: 5, explanation: `Synergy ${i}`,
    })),
  } as unknown as SynergyGroupData;
}

function renderModal(cardCount: number) {
  return render(
    <MemoryRouter>
      <CardDataProvider>
        <CardOverviewModal
          isOpen
          card={makeCard('source')}
          synergies={[makeGroup('singer-songs', 'Singer + Songs', cardCount)]}
          getPairSynergies={() => null}
          onClose={() => {}}
        />
      </CardDataProvider>
    </MemoryRouter>,
  );
}

test('second Show More opens the full expanded group view', async () => {
  const user = userEvent.setup();
  renderModal(20);
  // First More -> focused (isolates the group, still a More tile).
  await user.click(screen.getByRole('button', {name: /more/i}));
  // Second More -> full ExpandedGroupView with its back link.
  await user.click(screen.getByRole('button', {name: /more/i}));
  expect(screen.getByText(/back to all synergies/i)).toBeVisible();
});

test('Back to all synergies returns to the default view', async () => {
  const user = userEvent.setup();
  renderModal(20);
  await user.click(screen.getByRole('button', {name: /more/i}));
  await user.click(screen.getByRole('button', {name: /more/i}));
  expect(screen.getByText(/back to all synergies/i)).toBeVisible();
  await user.click(screen.getByText(/back to all synergies/i));
  expect(screen.queryByText(/back to all synergies/i)).toBeNull();
  expect(screen.getByRole('button', {name: /more/i})).toBeVisible();
});

test('changing the card resets the expanded view', async () => {
  const user = userEvent.setup();
  const group = makeGroup('singer-songs', 'Singer + Songs', 20);
  const tree = (card: LorcanaCard) => (
    <MemoryRouter>
      <CardDataProvider>
        <CardOverviewModal isOpen card={card} synergies={[group]} getPairSynergies={() => null} onClose={() => {}} />
      </CardDataProvider>
    </MemoryRouter>
  );
  const {rerender} = render(tree(makeCard('source')));
  await user.click(screen.getByRole('button', {name: /more/i}));
  await user.click(screen.getByRole('button', {name: /more/i}));
  expect(screen.getByText(/back to all synergies/i)).toBeVisible();
  rerender(tree(makeCard('other')));
  expect(screen.queryByText(/back to all synergies/i)).toBeNull();
  expect(screen.getByRole('button', {name: /more/i})).toBeVisible();
});
