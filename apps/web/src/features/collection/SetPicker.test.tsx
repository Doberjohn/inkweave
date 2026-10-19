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

  describe('with promo sets (#805)', () => {
    const sets = ['14', '13', 'CC', 'P1'];

    it('lists the promo sets after the sets, in a group under their heading, each by its code', () => {
      renderPicker({sets, progress: null});
      fireEvent.click(button());
      const group = screen.getByRole('group', {name: 'Promo sets'});
      expect(group).toHaveTextContent('Promo sets');
      const names = screen.getAllByRole('option').map((row) => row.getAttribute('aria-label'));
      expect(names.slice(-2)).toEqual(["Promo set CC, Curator's Collection", 'Promo set P1, Promo Set 1']);
    });

    it('names a promo set on its button by its code and its name', () => {
      renderPicker({sets, setCode: 'P1', progress: null});
      expect(button()).toHaveTextContent('Promo set · P1');
      expect(button()).toHaveTextContent('Promo Set 1');
      expect(button()).toHaveAccessibleName('Binder set: Promo set P1, Promo Set 1');
    });

    it("names Curator's Collection by CC, though its cards print their editions' codes (owner, 2026-10-19)", () => {
      renderPicker({sets, setCode: 'CC', progress: null});
      expect(button()).toHaveTextContent('Promo set · CC');
      fireEvent.click(button());
      expect(screen.getByRole('option', {name: /^Promo set CC,/})).toHaveTextContent(/^CCCurator's Collection$/);
    });

    it('moves from the sets into the promo sets with the arrow keys', () => {
      renderPicker({sets, setCode: '13', progress: null});
      fireEvent.click(button());
      fireEvent.keyDown(option('13'), {key: 'ArrowDown'});
      expect(screen.getByRole('option', {name: /^Promo set CC,/})).toHaveFocus();
    });
  });
});
