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
    onRemove: vi.fn(),
    ...over,
  };
  return {props, ...render(<DeckPanel {...props} />)};
}

const trashElsa = () => screen.getByRole('button', {name: /remove elsa - snow queen from deck/i});

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

  it('defers removal until the collapse transition ends', () => {
    const {props} = renderPanel();
    fireEvent.click(trashElsa());
    expect(props.onRemove).not.toHaveBeenCalled(); // deferred, not immediate
    fireEvent.transitionEnd(trashElsa(), {propertyName: 'max-height'});
    expect(props.onRemove).toHaveBeenCalledOnce();
    expect(props.onRemove).toHaveBeenCalledWith('ch1');
  });

  it('ignores an unrelated transition (e.g. opacity) — only max-height completes the removal', () => {
    const {props} = renderPanel();
    fireEvent.click(trashElsa());
    fireEvent.transitionEnd(trashElsa(), {propertyName: 'opacity'});
    expect(props.onRemove).not.toHaveBeenCalled();
  });

  it('flushes a pending removal when switching tabs (so the row cannot get stuck)', () => {
    const {props} = renderPanel();
    fireEvent.click(trashElsa());
    expect(props.onRemove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', {name: 'Analysis'}));
    expect(props.onRemove).toHaveBeenCalledOnce();
    expect(props.onRemove).toHaveBeenCalledWith('ch1');
  });

  it('aborts the removal if the quantity changed during the collapse', () => {
    const {props, rerender} = renderPanel();
    fireEvent.click(trashElsa());
    // The user re-incremented mid-collapse: the same card now has a new quantity.
    const bumped: DeckRow[] = [{...rows[0], quantity: 3}, rows[1]];
    rerender(<DeckPanel {...props} rows={bumped} />);
    fireEvent.transitionEnd(trashElsa(), {propertyName: 'max-height'});
    expect(props.onRemove).not.toHaveBeenCalled();
  });

  it('flushes a pending removal on unmount (transitionEnd never fires for an unmounted row)', () => {
    const {props, unmount} = renderPanel();
    fireEvent.click(trashElsa());
    expect(props.onRemove).not.toHaveBeenCalled();
    unmount(); // e.g. the user navigates away mid-collapse
    expect(props.onRemove).toHaveBeenCalledOnce();
    expect(props.onRemove).toHaveBeenCalledWith('ch1');
  });

  it('aborts the removal on unmount too if the quantity changed during the collapse', () => {
    const {props, rerender, unmount} = renderPanel();
    fireEvent.click(trashElsa());
    rerender(<DeckPanel {...props} rows={[{...rows[0], quantity: 3}, rows[1]]} />);
    unmount();
    expect(props.onRemove).not.toHaveBeenCalled();
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
    renderPanel({rows: [], stats: {...stats, totalCards: 0, uniqueCards: 0}});
    expect(screen.getByText(/no cards yet/i)).toBeInTheDocument();
    expect(screen.queryByText('None yet')).not.toBeInTheDocument();
  });
});
