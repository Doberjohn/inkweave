import {render, screen} from '@testing-library/react';
import {test, expect, vi} from 'vitest';
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

test('Show More opens the full expanded group view', async () => {
  const user = userEvent.setup();
  renderModal(20);
  // One More click jumps straight to the full ExpandedGroupView with its back link.
  await user.click(screen.getByRole('button', {name: /more/i}));
  expect(screen.getByText(/back to all synergies/i)).toBeVisible();
});

test('Back to all synergies returns to the default view', async () => {
  const user = userEvent.setup();
  renderModal(20);
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
  expect(screen.getByText(/back to all synergies/i)).toBeVisible();
  rerender(tree(makeCard('other')));
  expect(screen.queryByText(/back to all synergies/i)).toBeNull();
  expect(screen.getByRole('button', {name: /more/i})).toBeVisible();
});

test('a foreign-scan card toggles its English text; the next card starts on its scan', async () => {
  const user = userEvent.setup();
  const japanese = (id: string) => ({...makeCard(id), scanLanguage: 'ja', textSections: ['Draw a card.']});
  const tree = (card: LorcanaCard) => (
    <MemoryRouter>
      <CardOverviewModal isOpen card={card} synergies={[]} getPairSynergies={() => null} onClose={() => {}} />
    </MemoryRouter>
  );
  const {rerender} = render(tree(japanese('jp1')));

  await user.click(screen.getByRole('button', {name: 'See translation'}));
  expect(screen.getByRole('region', {name: 'English translation of Card jp1 - Test'})).toHaveTextContent('Draw a card.');

  rerender(tree(japanese('jp2')));
  expect(screen.queryByTestId('card-translation')).toBeNull();
  expect(screen.getByRole('button', {name: 'See translation'})).toBeVisible();

  rerender(tree(makeCard('en')));
  expect(screen.queryByRole('button', {name: /see (translation|card)/i})).toBeNull();

  // Paging back to a card whose translation was open starts on its scan again.
  rerender(tree(japanese('jp1')));
  expect(screen.queryByTestId('card-translation')).toBeNull();
});

test('paging away from a focused translation toggle keeps focus in the dialog', async () => {
  const user = userEvent.setup();
  const tree = (card: LorcanaCard) => (
    <MemoryRouter>
      <CardOverviewModal isOpen card={card} synergies={[]} getPairSynergies={() => null} onClose={() => {}} />
    </MemoryRouter>
  );
  const {rerender} = render(tree({...makeCard('jp'), scanLanguage: 'ja'}));
  await user.click(screen.getByRole('button', {name: 'See translation'}));
  expect(screen.getByRole('button', {name: 'See card'})).toHaveFocus();

  rerender(tree(makeCard('en')));
  expect(screen.getByRole('dialog')).toContainElement(document.activeElement as HTMLElement);
});

test('the expanded group view hides the translation toggle, which has no card image to cover', async () => {
  const user = userEvent.setup();
  render(
    <MemoryRouter>
      <CardDataProvider>
        <CardOverviewModal
          isOpen
          card={{...makeCard('jp'), scanLanguage: 'ja'}}
          synergies={[makeGroup('singer-songs', 'Singer + Songs', 20)]}
          getPairSynergies={() => null}
          onClose={() => {}}
        />
      </CardDataProvider>
    </MemoryRouter>,
  );
  expect(screen.getByRole('button', {name: 'See translation'})).toBeVisible();
  await user.click(screen.getByRole('button', {name: /more/i}));
  // Hidden, not removed, so the header keeps its height (a hidden button has no accessible name).
  expect(screen.getByText('See translation')).not.toBeVisible();
});

function renderWithSiblings(opts: {onGoToSibling?: (d: 1 | -1) => void; siblingCardIds?: string[]} = {}) {
  return render(
    <MemoryRouter>
      <CardOverviewModal isOpen card={makeCard('b')} synergies={[]} getPairSynergies={() => null} onClose={() => {}}
        siblingCardIds={opts.siblingCardIds ?? ['a', 'b', 'c']} onGoToSibling={opts.onGoToSibling ?? (() => {})} />
    </MemoryRouter>,
  );
}

test('shows prev/next arrows and calls onGoToSibling', async () => {
  const user = userEvent.setup();
  const onGoToSibling = vi.fn();
  renderWithSiblings({onGoToSibling});
  await user.click(screen.getByRole('button', {name: /next card/i}));
  expect(onGoToSibling).toHaveBeenCalledWith(1);
  await user.click(screen.getByRole('button', {name: /previous card/i}));
  expect(onGoToSibling).toHaveBeenCalledWith(-1);
});

test('hides arrows when there is one or zero siblings', () => {
  renderWithSiblings({siblingCardIds: ['b']});
  expect(screen.queryByRole('button', {name: /next card/i})).toBeNull();
});

test('ArrowRight / ArrowLeft navigate siblings', async () => {
  const user = userEvent.setup();
  const onGoToSibling = vi.fn();
  renderWithSiblings({onGoToSibling});
  screen.getByRole('button', {name: /next card/i}).focus();
  await user.keyboard('{ArrowRight}');
  expect(onGoToSibling).toHaveBeenCalledWith(1);
  await user.keyboard('{ArrowLeft}');
  expect(onGoToSibling).toHaveBeenCalledWith(-1);
});
