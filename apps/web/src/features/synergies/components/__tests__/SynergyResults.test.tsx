import {describe, it, expect, vi} from 'vitest';
import {render, screen, fireEvent} from '@testing-library/react';
import {SynergyResults} from '../SynergyResults';
import type {SynergyGroup as SynergyGroupData} from '../../types';
import type {LorcanaCard} from '../../../cards';
import {createCard, createSynergyGroup} from '../../../../shared/test-utils';

// Mock child components. The stub surfaces `playstyleHref` as a data attribute so tests can assert
// the parent's #498 Phase 3 gating policy (which groups get a /playstyles/:id link) without a router.
// NOTE: inlined per factory (not a shared const) — vi.mock is hoisted above top-level consts.
vi.mock('../SynergyGroup', () => ({
  SynergyGroup: ({group, playstyleHref}: {group: SynergyGroupData; playstyleHref?: string}) => (
    <div data-testid="synergy-group" data-playstyle-href={playstyleHref ?? ''}>
      {group.label}
    </div>
  ),
}));

vi.mock('.', () => ({
  CardDetail: ({card}: {card: LorcanaCard}) => <div data-testid="card-detail">{card.name}</div>,
  SynergyGroup: ({group, playstyleHref}: {group: SynergyGroupData; playstyleHref?: string}) => (
    <div data-testid="synergy-group" data-playstyle-href={playstyleHref ?? ''}>
      {group.label}
    </div>
  ),
}));

vi.mock('../../../../shared/components', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../shared/components')>();
  return {
    ...actual,
    EmptyState: () => <div data-testid="empty-state" />,
  };
});

const mockCard = createCard({
  id: '1',
  fullName: 'Elsa - Snow Queen',
  name: 'Elsa',
  ink: 'Amethyst',
  cost: 4,
});

const mockSynergies: SynergyGroupData[] = [
  createSynergyGroup({
    groupKey: 'shift-targets',
    category: 'direct',
    label: 'Shift Targets',
    synergies: [{card: mockCard, score: 7, explanation: 'Shift'}],
  }),
  createSynergyGroup({
    groupKey: 'lore-denial',
    category: 'playstyle',
    label: 'Lore Steal',
    description: 'Cards that prevent opponents from gaining lore',
    synergies: [{card: {...mockCard, id: '2'}, score: 5, explanation: 'Lore denial'}],
  }),
];

describe('SynergyResults', () => {
  it('should render synergies title as h2 heading', () => {
    render(
      <SynergyResults
        selectedCard={mockCard}
        synergies={mockSynergies}
        totalSynergyCount={2}
        onClearSelection={vi.fn()}
      />,
    );
    expect(screen.getByRole('heading', {level: 2})).toHaveTextContent('Synergies');
  });

  it('should wrap content in a section element', () => {
    render(
      <SynergyResults
        selectedCard={mockCard}
        synergies={mockSynergies}
        totalSynergyCount={2}
        onClearSelection={vi.fn()}
      />,
    );
    const section = document.querySelector('section');
    expect(section).toBeInTheDocument();
  });

  it('should render group filter chips', () => {
    render(
      <SynergyResults
        selectedCard={mockCard}
        synergies={mockSynergies}
        totalSynergyCount={2}
        onClearSelection={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', {name: 'All'})).toBeTruthy();
    expect(screen.getByRole('button', {name: 'Shift Targets'})).toBeTruthy();
    expect(screen.getByRole('button', {name: 'Lore Steal'})).toBeTruthy();
  });

  it('should render sort select', () => {
    render(
      <SynergyResults
        selectedCard={mockCard}
        synergies={mockSynergies}
        totalSynergyCount={2}
        onClearSelection={vi.fn()}
      />,
    );
    expect(screen.getByRole('combobox', {name: 'Sort synergies'})).toBeTruthy();
  });

  it('should filter groups when chip is clicked', () => {
    render(
      <SynergyResults
        selectedCard={mockCard}
        synergies={mockSynergies}
        totalSynergyCount={2}
        onClearSelection={vi.fn()}
      />,
    );
    // Click "Shift Targets" chip
    fireEvent.click(screen.getByRole('button', {name: 'Shift Targets'}));
    const groups = screen.getAllByTestId('synergy-group');
    expect(groups).toHaveLength(1);
    expect(groups[0]).toHaveTextContent('Shift Targets');
  });

  it('should hide group chips when only 1 synergy group', () => {
    const singleGroup = [mockSynergies[0]];
    render(
      <SynergyResults
        selectedCard={mockCard}
        synergies={singleGroup}
        totalSynergyCount={1}
        onClearSelection={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', {name: 'All'})).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Shift Targets'})).not.toBeInTheDocument();
  });

  it('should still show sort select when only 1 synergy group', () => {
    const singleGroup = [mockSynergies[0]];
    render(
      <SynergyResults
        selectedCard={mockCard}
        synergies={singleGroup}
        totalSynergyCount={1}
        onClearSelection={vi.fn()}
      />,
    );
    expect(screen.getByRole('combobox', {name: 'Sort synergies'})).toBeInTheDocument();
  });

  // #498 Phase 3 gating policy: a /playstyles/:id hub link is passed ONLY to playstyle-category
  // groups, and ONLY when linkPlaystyleHeaders is set (card page). This is the load-bearing rule
  // the change adds — a regression (dropping either condition) would leak a broken/miscategorised link.
  it('links only playstyle group headers, and only when linkPlaystyleHeaders is set', () => {
    const hrefByLabel = () =>
      Object.fromEntries(
        screen
          .getAllByTestId('synergy-group')
          .map((el) => [el.textContent?.trim(), el.getAttribute('data-playstyle-href')]),
      );

    const {rerender} = render(
      <SynergyResults
        selectedCard={mockCard}
        synergies={mockSynergies}
        totalSynergyCount={2}
        onClearSelection={vi.fn()}
        linkPlaystyleHeaders
      />,
    );
    // groupKey 'lore-denial' (playstyle) gets the hub link; 'shift-targets' (direct) gets none.
    expect(hrefByLabel()).toEqual({'Lore Steal': '/playstyles/lore-denial', 'Shift Targets': ''});

    // Without the flag (the modal path), no group is linked.
    rerender(
      <SynergyResults
        selectedCard={mockCard}
        synergies={mockSynergies}
        totalSynergyCount={2}
        onClearSelection={vi.fn()}
      />,
    );
    expect(hrefByLabel()).toEqual({'Lore Steal': '', 'Shift Targets': ''});
  });
});
