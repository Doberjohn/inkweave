import {describe, it, expect, vi} from 'vitest';
import {render, screen, fireEvent} from '@testing-library/react';
import {SetPicker} from './SetPicker';

const PROGRESS = new Map([
  ['all', {complete: 2717, cards: 2873}],
  ['13', {complete: 75, cards: 207}],
  ['12', {complete: 204, cards: 204}],
]);

function renderPicker(overrides: Partial<Parameters<typeof SetPicker>[0]> = {}) {
  const props = {setCode: '13', sets: ['14', '13', '12'], setsLoading: false, onSetChange: vi.fn(), progress: PROGRESS, ...overrides};
  render(<SetPicker {...props} />);
  return props;
}

const button = () => screen.getByRole('button', {name: /^Binder set/});
const option = (set: string) => screen.getByRole('option', {name: new RegExp(`^Set ${set},`)});

describe('SetPicker', () => {
  it('lists every set with its progress, the open set selected and focused', () => {
    renderPicker();
    fireEvent.click(button());
    expect(screen.getAllByRole('option')).toHaveLength(4);
    const open = screen.getByRole('option', {name: 'Set 13, Attack of the Vine!: 36% complete'});
    expect(open).toHaveAttribute('aria-selected', 'true');
    expect(open).toHaveFocus();
  });

  it('shows a dash for a set the filters leave no card in', () => {
    renderPicker({progress: new Map([...PROGRESS, ['14', {complete: 0, cards: 0}]])});
    fireEvent.click(button());
    const empty = screen.getByRole('option', {name: /^Set 14,.*: no matching cards$/});
    expect(empty).toHaveTextContent('–');
  });

  it("pins the whole collection first, with the collection's progress", () => {
    renderPicker();
    fireEvent.click(button());
    expect(screen.getAllByRole('option')[0]).toHaveAccessibleName('Whole collection: 94% complete');
  });

  it('names the whole collection on its button while the binder holds it', () => {
    renderPicker({setCode: 'all'});
    expect(screen.getByRole('button', {name: 'Binder set: Whole collection'})).toHaveTextContent('3 sets');
  });

  it('opens the set picked, closes, and gives focus back to the button', () => {
    const {onSetChange} = renderPicker();
    fireEvent.click(button());
    fireEvent.click(option('12'));
    expect(onSetChange).toHaveBeenCalledWith('12');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(button()).toHaveFocus();
  });

  it('moves through the sets with the arrow keys, Home and End', () => {
    renderPicker();
    fireEvent.click(button());
    fireEvent.keyDown(option('13'), {key: 'ArrowDown'});
    expect(option('12')).toHaveFocus();
    fireEvent.keyDown(option('12'), {key: 'Home'});
    expect(screen.getByRole('option', {name: /^Whole collection/})).toHaveFocus();
  });

  it('opens from the keyboard, and Escape closes it back onto the button', () => {
    renderPicker();
    fireEvent.keyDown(button(), {key: 'ArrowDown'});
    expect(option('13')).toHaveFocus();
    fireEvent.keyDown(option('13'), {key: 'Escape'});
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(button()).toHaveFocus();
  });

  it('closes on a press outside', () => {
    renderPicker();
    fireEvent.click(button());
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('waits for the set list before it opens', () => {
    renderPicker({setsLoading: true});
    expect(button()).toBeDisabled();
  });

  it('lists the sets without percentages while the pool loads', () => {
    renderPicker({progress: null});
    fireEvent.click(button());
    expect(screen.getByRole('option', {name: 'Set 13, Attack of the Vine!'})).toBeInTheDocument();
  });
});
