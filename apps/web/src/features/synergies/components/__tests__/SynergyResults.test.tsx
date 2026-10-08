import type {ComponentProps} from 'react';
import {describe, it, expect, vi} from 'vitest';
import {render, screen, fireEvent} from '@testing-library/react';
import {SynergyResults} from '../SynergyResults';
import type {SynergyGroup as SynergyGroupData} from '../../types';
import {createCard, createSynergyGroup} from '../../../../shared/test-utils';

// The stub surfaces `playstyleHref` as a data attribute so tests can assert which groups get a
// /playstyles/:id hub link (#498 Phase 3) without a router.
vi.mock('../SynergyGroup', () => ({
  SynergyGroup: ({group, playstyleHref}: {group: SynergyGroupData; playstyleHref?: string}) => (
    <div data-testid="synergy-group" data-playstyle-href={playstyleHref ?? ''}>
      {group.label}
    </div>
  ),
}));

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

/** Renders with the full prop set CardPage passes: desktop, no filter, nothing expanded. */
function renderResults(overrides: Partial<ComponentProps<typeof SynergyResults>> = {}) {
  return render(
    <SynergyResults
      selectedCard={mockCard}
      synergies={mockSynergies}
      totalSynergyCount={2}
      onClearSelection={vi.fn()}
      isMobile={false}
      showCardDetail={false}
      activeGroupFilter={null}
      onGroupFilterChange={vi.fn()}
      expandedGroup={null}
      onShowAll={vi.fn()}
      onBackToAll={vi.fn()}
      onSynergyCardClick={vi.fn()}
      {...overrides}
    />,
  );
}

describe('SynergyResults', () => {
  it('should render synergies title as h2 heading', () => {
    renderResults();
    expect(screen.getByRole('heading', {level: 2})).toHaveTextContent('Synergies');
  });

  // The card page owns the document's single h1 (#524); on mobile that is the inline card detail.
  it('should render the inline card detail as the h1', () => {
    renderResults({isMobile: true, showCardDetail: true});
    expect(screen.getByRole('heading', {level: 1})).toHaveTextContent('Elsa');
  });

  it('should wrap content in a section element', () => {
    renderResults();
    const section = document.querySelector('section');
    expect(section).toBeInTheDocument();
  });

  it('should render group filter chips', () => {
    renderResults();
    expect(screen.getByRole('button', {name: 'All'})).toBeTruthy();
    expect(screen.getByRole('button', {name: 'Shift Targets'})).toBeTruthy();
    expect(screen.getByRole('button', {name: 'Lore Steal'})).toBeTruthy();
  });

  it('should render sort select', () => {
    renderResults();
    expect(screen.getByRole('combobox', {name: 'Sort synergies'})).toBeTruthy();
  });

  // The filter is controlled: CardPage owns it, so a chip click only reports the group key...
  it('should report the clicked chip group key', () => {
    const onGroupFilterChange = vi.fn();
    renderResults({onGroupFilterChange});
    fireEvent.click(screen.getByRole('button', {name: 'Shift Targets'}));
    expect(onGroupFilterChange).toHaveBeenCalledWith('shift-targets');
  });

  // ...and the visible groups follow the activeGroupFilter that comes back down.
  it('should show only the group named by activeGroupFilter', () => {
    renderResults({activeGroupFilter: 'shift-targets'});
    const groups = screen.getAllByTestId('synergy-group');
    expect(groups).toHaveLength(1);
    expect(groups[0]).toHaveTextContent('Shift Targets');
  });

  it('should hide group chips when only 1 synergy group', () => {
    renderResults({synergies: [mockSynergies[0]], totalSynergyCount: 1});
    expect(screen.queryByRole('button', {name: 'All'})).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Shift Targets'})).not.toBeInTheDocument();
  });

  // While the card's synergies load the list is empty, which must not read as "no synergies".
  it('shows the loading skeleton, not the empty notice, while synergies load', () => {
    renderResults({synergies: [], totalSynergyCount: 0, isLoading: true});
    expect(screen.getByRole('status', {name: 'Loading synergies'})).toBeInTheDocument();
    expect(screen.queryByText('No synergies found for this card.')).not.toBeInTheDocument();
  });

  it('shows the empty notice once loading settles with no synergies', () => {
    renderResults({synergies: [], totalSynergyCount: 0, isLoading: false});
    expect(screen.getByText('No synergies found for this card.')).toBeInTheDocument();
    expect(screen.queryByRole('status', {name: 'Loading synergies'})).not.toBeInTheDocument();
  });

  it('should still show sort select when only 1 synergy group', () => {
    renderResults({synergies: [mockSynergies[0]], totalSynergyCount: 1});
    expect(screen.getByRole('combobox', {name: 'Sort synergies'})).toBeInTheDocument();
  });

  // #498 Phase 3: a /playstyles/:id hub link goes ONLY to playstyle-category groups. Dropping the
  // category check would put a broken link on direct groups like Shift Targets.
  it('links only playstyle group headers', () => {
    renderResults();
    const hrefByLabel = Object.fromEntries(
      screen
        .getAllByTestId('synergy-group')
        .map((el) => [el.textContent?.trim(), el.getAttribute('data-playstyle-href')]),
    );
    // groupKey 'lore-denial' (playstyle) gets the hub link; 'shift-targets' (direct) gets none.
    expect(hrefByLabel).toEqual({'Lore Steal': '/playstyles/lore-denial', 'Shift Targets': ''});
  });
});
