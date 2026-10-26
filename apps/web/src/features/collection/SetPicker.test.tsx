import {afterEach, describe, it, expect, vi} from 'vitest';
import {cleanup, render, screen, fireEvent, within} from '@testing-library/react';
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
const allSets = () => screen.getByRole('option', {name: /^All sets, the whole collection/});
const tab = (name: string) => within(screen.getByRole('dialog', {name: 'Binder set'})).getByRole('button', {name});
const rowNames = () => screen.getAllByRole('option').map((row) => row.getAttribute('aria-label'));

describe('SetPicker', () => {
  it('lists the standard sets with their progress, the open set selected and focused', () => {
    renderPicker();
    fireEvent.click(button());
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

  it("starts the list with All sets, the whole collection's progress, selected and focused while it is open (owner, 2026-10-20)", () => {
    renderPicker({setCode: 'all'});
    fireEvent.click(button());
    expect(rowNames()).toEqual([
      'All sets, the whole collection: 94% complete',
      'Set 14, Hyperia City',
      'Set 13, Attack of the Vine!: 36% complete',
      'Set 12, The Wilds Unknown: 100% complete',
    ]);
    expect(allSets()).toHaveAttribute('aria-selected', 'true');
    expect(allSets()).toHaveFocus();
  });

  it('opens the set picked, or the whole collection from All sets, closing back onto the button', () => {
    const {onSetChange} = renderPicker();
    fireEvent.click(button());
    fireEvent.click(option('12'));
    expect(onSetChange).toHaveBeenCalledWith('12');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(button()).toHaveFocus();
    fireEvent.click(button());
    fireEvent.click(allSets());
    expect(onSetChange).toHaveBeenLastCalledWith('all');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('names the whole collection or every promo set on its button, counting their sets', () => {
    renderPicker({setCode: 'all'});
    expect(screen.getByRole('button', {name: 'Binder set: Whole collection'})).toHaveTextContent('3 sets');
    renderPicker({setCode: 'promos', sets: ['14', 'CC', 'P1']});
    expect(screen.getByRole('button', {name: 'Binder set: All promo sets'})).toHaveTextContent(/^2 promo setsAll promo sets$/);
  });

  it("fits the toolbar's 111px beside Collection and the gear: a set's number, All sets, or Promos, with no picture (owner, 2026-10-20)", () => {
    renderPicker({size: 'toolbar'});
    expect(button()).toHaveTextContent(/^Set 13$/);
    expect(button()).toHaveStyle({minHeight: '34px'});
    renderPicker({size: 'toolbar', setCode: 'all'});
    expect(screen.getByRole('button', {name: 'Binder set: All sets, the whole collection'})).toHaveTextContent(/^All sets$/);
    renderPicker({size: 'toolbar', setCode: 'promos', sets: ['14', 'P1']});
    expect(screen.getByRole('button', {name: 'Binder set: Promos, every promo set'})).toHaveTextContent(/^Promos$/);
    for (const toolbarButton of screen.getAllByRole('button', {name: /^Binder set/})) {
      expect(toolbarButton.querySelector('img')).toBeNull();
    }
  });

  describe("in the phone binder's row (#969)", () => {
    const figures = {shown: '36% · 12%', words: '36% complete, 12% master'};

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("shows the set's logo and its name over the figures, says them in words after its text, and opens the same list", () => {
      renderPicker({size: 'row', figures});
      expect(button()).toHaveAccessibleName('Binder set: Attack of the Vine!, 36% · 12%: 36% complete, 12% master');
      // Named by a line only screen readers get, never an aria-label, which would have to hold
      // the drawn lines' text as axe reads it, run together (WCAG 2.5.3).
      expect(button()).not.toHaveAttribute('aria-label');
      expect(button().querySelector(':scope > [aria-hidden="true"]')).toHaveTextContent(/^Attack of the Vine!36% · 12%$/);
      expect(button()).toHaveStyle({minHeight: '40px'});
      expect(button().querySelector('img')).not.toBeNull();
      fireEvent.click(button());
      fireEvent.click(option('12'));
      expect(button()).toHaveFocus();
    });

    it("holds the figures' line with a shimmer while the numbers load, and names the scope alone", () => {
      renderPicker({size: 'row'});
      expect(button()).toHaveAccessibleName('Binder set: Attack of the Vine!');
      expect(button().querySelector('.react-loading-skeleton')).not.toBeNull();
    });

    it('leaves its logo out below 360px, so its words keep their room', () => {
      vi.stubGlobal('innerWidth', 359);
      renderPicker({size: 'row', figures});
      expect(button().querySelector('img')).toBeNull();
      cleanup();
      vi.stubGlobal('innerWidth', 360);
      renderPicker({size: 'row', figures});
      expect(button().querySelector('img')).not.toBeNull();
    });
  });

  it('shows no tabs without a promo set, and moves through the list with the arrows, Home and End', () => {
    renderPicker();
    fireEvent.click(button());
    expect(screen.queryByRole('group', {name: 'Sets'})).toBeNull();
    fireEvent.keyDown(option('13'), {key: 'ArrowDown'});
    expect(option('12')).toHaveFocus();
    fireEvent.keyDown(option('12'), {key: 'Home'});
    expect(allSets()).toHaveFocus();
  });

  it('opens from the keyboard, and Escape closes it back onto the button', () => {
    renderPicker();
    fireEvent.keyDown(button(), {key: 'ArrowDown'});
    expect(option('13')).toHaveFocus();
    fireEvent.keyDown(option('13'), {key: 'Escape'});
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(button()).toHaveFocus();
  });

  it('closes on a press outside', () => {
    renderPicker();
    fireEvent.click(button());
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('waits for the set list before it opens', () => {
    renderPicker({setsLoading: true});
    expect(button()).toBeDisabled();
  });

  describe('with promo sets (#805)', () => {
    const sets = ['14', '13', 'CC', 'P1'];

    it('lists the promo sets under their own tab, each by its code, after All sets, which opens every one (owner, 2026-10-20)', () => {
      const {onSetChange} = renderPicker({sets, progress: null});
      fireEvent.click(button());
      expect(tab('Standard')).toHaveAttribute('aria-pressed', 'true');
      fireEvent.click(tab('Promo'));
      expect(tab('Promo')).toHaveAttribute('aria-pressed', 'true');
      expect(rowNames()).toEqual([
        'All sets, every promo set',
        "Promo set CC, Curator's Collection",
        'Promo set P1, Promo Set 1',
      ]);
      fireEvent.click(screen.getByRole('option', {name: 'All sets, every promo set'}));
      expect(onSetChange).toHaveBeenCalledWith('promos');
    });

    it("opens on the promo sets' tab for a promo set, its row focused", () => {
      renderPicker({sets, setCode: 'P1', progress: null});
      fireEvent.click(button());
      expect(tab('Promo')).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('option', {name: 'Promo set P1, Promo Set 1'})).toHaveFocus();
    });

    it("opens the whole collection's menu on Promo while the Rarity filter picks the promos, a set's on its own (owner, 2026-10-20)", () => {
      renderPicker({sets, setCode: 'all', picksPromos: true, progress: null});
      fireEvent.click(button());
      expect(tab('Promo')).toHaveAttribute('aria-pressed', 'true');
      expect(tab('Promo')).toHaveFocus();
      cleanup();
      renderPicker({sets, setCode: '13', picksPromos: true, progress: null});
      fireEvent.click(button());
      expect(tab('Standard')).toHaveAttribute('aria-pressed', 'true');
    });

    it("opens on the promo sets' tab for every promo set, All sets selected and focused", () => {
      renderPicker({sets, setCode: 'promos', progress: new Map([['promos', {complete: 1, cards: 4}]])});
      fireEvent.click(button());
      expect(tab('Promo')).toHaveAttribute('aria-pressed', 'true');
      const all = screen.getByRole('option', {name: 'All sets, every promo set: 25% complete'});
      expect(all).toHaveAttribute('aria-selected', 'true');
      expect(all).toHaveFocus();
    });

    it('moves up from All sets onto its tab, along the tabs round from either end, showing their sets, and down the list', () => {
      renderPicker({sets, setCode: '14', progress: null});
      fireEvent.click(button());
      fireEvent.keyDown(option('14'), {key: 'ArrowUp'});
      expect(allSets()).toHaveFocus();
      fireEvent.keyDown(allSets(), {key: 'ArrowUp'});
      expect(tab('Standard')).toHaveFocus();
      // Left from the first tab comes round to the last, and right from the last back to
      // the first, each showing its sets.
      fireEvent.keyDown(tab('Standard'), {key: 'ArrowLeft'});
      expect(tab('Promo')).toHaveFocus();
      expect(tab('Promo')).toHaveAttribute('aria-pressed', 'true');
      fireEvent.keyDown(tab('Promo'), {key: 'ArrowRight'});
      expect(tab('Standard')).toHaveFocus();
      expect(tab('Standard')).toHaveAttribute('aria-pressed', 'true');
      // Down from a tab enters the list it shows.
      fireEvent.keyDown(tab('Standard'), {key: 'ArrowRight'});
      fireEvent.keyDown(tab('Promo'), {key: 'ArrowDown'});
      expect(screen.getByRole('option', {name: 'All sets, every promo set'})).toHaveFocus();
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
  });
});
