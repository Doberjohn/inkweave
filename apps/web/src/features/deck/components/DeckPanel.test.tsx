import {describe, expect, it, vi} from 'vitest';
import {fireEvent, render, screen} from '@testing-library/react';
import type {DeckStats} from '../types';
import {DeckPanel, type DeckRow} from './DeckPanel';
import {createCard} from '../../../shared/test-utils';

const stats: DeckStats = {
  totalCards: 3,
  uniqueCards: 2,
  inkDistribution: {Amber: 3},
  costCurve: {2: 3},
  costCurveByInk: {2: {Amber: 3}},
  typeDistribution: {Character: 2, Action: 1},
  inkCount: 1,
  inkableCount: 3,
  isLegal: false,
  legalityErrors: [],
};

const rows: DeckRow[] = [
  {card: createCard({id: 'ch1', fullName: 'Elsa - Snow Queen', type: 'Character'}), quantity: 2},
  {card: createCard({id: 'ac1', fullName: 'Fire the Cannons - Blast', type: 'Action'}), quantity: 1},
];

type Props = Parameters<typeof DeckPanel>[0];

function renderPanel(over: Partial<Props> = {}) {
  const props: Props = {
    name: 'Test Deck',
    onRename: vi.fn(),
    rows,
    stats,
    onIncrement: vi.fn(),
    onDecrement: vi.fn(),
    ...over,
  };
  return {props, ...render(<DeckPanel {...props} />)};
}

describe('DeckPanel', () => {
  it('groups rows under type headers, hiding empty groups', () => {
    renderPanel();
    // rows has a Character + an Action, so those two headers render.
    expect(screen.getByText('Characters')).toBeInTheDocument();
    expect(screen.getByText('Actions')).toBeInTheDocument();
    // Songs / Items / Locations are empty → their headers are not rendered at all.
    expect(screen.queryByText('Songs')).not.toBeInTheDocument();
    expect(screen.queryByText('Items')).not.toBeInTheDocument();
    expect(screen.queryByText('Locations')).not.toBeInTheDocument();
    expect(screen.queryByText('None yet')).not.toBeInTheDocument();
  });

  // Removal is the stepper's − at one copy; there is no separate delete affordance.
  it('renders no per-row delete button', () => {
    renderPanel();
    expect(screen.queryByRole('button', {name: /from deck/i})).not.toBeInTheDocument();
  });

  it('switches the stats view between the cost curve and the deck profile', () => {
    renderPanel();
    expect(screen.getByRole('tab', {name: /cost curve/i})).toHaveAttribute('aria-selected', 'true');
    // Curve first: the profile's ink breakdown is not rendered yet.
    expect(screen.queryByText('Inkable')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', {name: /deck stats/i}));
    expect(screen.getByRole('tab', {name: /deck stats/i})).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Inkable')).toBeInTheDocument();
  });

  it('opens details with the ids in rendered (type-grouped) order, not the given row order', () => {
    const onOpenDetails = vi.fn();
    // Page order is cost-then-name, so the Action can precede the Character...
    renderPanel({rows: [rows[1], rows[0]], onOpenDetails});
    fireEvent.click(screen.getByRole('button', {name: /view elsa - snow queen synergies/i}));
    // ...but the modal's arrow-nav must walk Characters before Actions, as rendered.
    expect(onOpenDetails).toHaveBeenCalledWith(rows[0].card, ['ch1', 'ac1']);
  });

  it('opens details from the keyboard', () => {
    const onOpenDetails = vi.fn();
    renderPanel({onOpenDetails});
    fireEvent.keyDown(screen.getByRole('button', {name: /view elsa - snow queen synergies/i}), {key: 'Enter'});
    expect(onOpenDetails).toHaveBeenCalledOnce();
  });

  it('shows the empty prompt (not five empty groups) when the deck has no cards', () => {
    renderPanel({rows: [], stats: {...stats, totalCards: 0, uniqueCards: 0, costCurve: {}, costCurveByInk: {}}});
    expect(screen.getByText(/no cards yet/i)).toBeInTheDocument();
    expect(screen.queryByText('None yet')).not.toBeInTheDocument();
  });
});
