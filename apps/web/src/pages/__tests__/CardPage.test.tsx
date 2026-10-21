import {describe, it, expect, vi, beforeEach} from 'vitest';
import {render, screen, fireEvent} from '@testing-library/react';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {cardPath} from 'inkweave-synergy-engine/card';
import {CardPage} from '../CardPage';
import {
  trackSynergyCardClicked,
  trackSynergyGroupViewed,
} from '../../features/synergies/lib/synergyAnalytics';

const {ELSA, ANNA} = vi.hoisted(() => ({
  ELSA: {id: '13001', fullName: 'Elsa - Snow Queen', ink: 'Amethyst'} as LorcanaCard,
  ANNA: {id: '13002', fullName: 'Anna - Heir to Arendelle', ink: 'Amber'} as LorcanaCard,
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {...actual, useNavigate: () => mockNavigate};
});

vi.mock('../../shared/hooks', () => ({
  useResponsive: () => ({isMobile: false, isTablet: false, isDesktop: true, windowWidth: 1280}),
  useBackOrNavigate: () => vi.fn(),
}));

vi.mock('../../shared/contexts/CardDataContext', () => ({
  useCardDataContext: () => ({getCardById: () => ELSA, isLoading: false}),
}));

vi.mock('../../shared/components', () => ({
  CompactHeader: () => <header />,
  Footer: () => null,
  Seo: () => null,
}));

vi.mock('../../features/synergies/hooks', () => ({
  usePrecomputedSynergies: () => ({synergies: [], isLoading: false}),
}));

vi.mock('../../features/synergies/cardSynergySummary', () => ({cardSynergySummary: () => ''}));

vi.mock('../../features/synergies/components/CardDetailPanel', () => ({
  CardDetailPanel: () => null,
}));

// Stands in for the results: one control per callback the page hands it.
vi.mock('../../features/synergies/components/SynergyResults', () => ({
  SynergyResults: (props: {
    onSynergyCardClick: (card: LorcanaCard, groupKey?: string) => void;
    onGroupFilterChange: (groupKey: string | null) => void;
    onShowAll: (groupKey: string) => void;
  }) => (
    <div>
      <button onClick={() => props.onSynergyCardClick(ANNA, 'singer')}>Anna</button>
      <button onClick={() => props.onGroupFilterChange('singer')}>Singer chip</button>
      <button onClick={() => props.onGroupFilterChange(null)}>All chip</button>
      <button onClick={() => props.onShowAll('singer')}>More</button>
    </div>
  ),
}));

vi.mock('../../features/synergies/lib/synergyAnalytics', () => ({
  trackSynergyCardClicked: vi.fn(),
  trackSynergyGroupViewed: vi.fn(),
}));

function renderPage() {
  render(
    <MemoryRouter initialEntries={['/card/13001/elsa-snow-queen']}>
      <Routes>
        <Route path="/card/:cardId/:slug" element={<CardPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('CardPage synergy analytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('tracks a followed partner from the card page, then opens its page', () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', {name: 'Anna'}));

    expect(trackSynergyCardClicked).toHaveBeenCalledWith({
      sourceCardId: '13001',
      clicked: ANNA,
      groupKey: 'singer',
      surface: 'card_page',
    });
    expect(mockNavigate).toHaveBeenCalledWith(cardPath(ANNA));
  });

  // A group's chip isolates it, and its More tile expands it.
  it.each([
    {control: 'Singer chip', action: 'isolate'},
    {control: 'More', action: 'show_all'},
  ] as const)('tracks a group view ($action) from its $control', ({control, action}) => {
    renderPage();

    fireEvent.click(screen.getByRole('button', {name: control}));

    expect(trackSynergyGroupViewed).toHaveBeenCalledWith({
      sourceCardId: '13001',
      groupKey: 'singer',
      action,
      surface: 'card_page',
    });
  });

  it('sends nothing when the chip is pressed again or cleared', () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', {name: 'Singer chip'}));
    fireEvent.click(screen.getByRole('button', {name: 'Singer chip'}));
    fireEvent.click(screen.getByRole('button', {name: 'All chip'}));

    expect(trackSynergyGroupViewed).toHaveBeenCalledTimes(1);
  });
});
