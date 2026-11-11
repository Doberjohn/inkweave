import {beforeEach, describe, expect, it, vi} from 'vitest';
import {act, fireEvent, render, screen, within} from '@testing-library/react';
import {trackEvent} from '../../../shared/lib/analytics';
import {WHOLE_COLLECTION, scopeName} from '../binderCards';
import type {SaveOffer} from './binderChoices';
import type {Binder} from './binderRules';
import type {CreateResult} from './binderShelf';
import {SaveAsBinder, type SaveAsBinderProps} from './SaveAsBinder';

vi.mock('../../../shared/lib/analytics', () => ({trackEvent: vi.fn()}));
const writes = vi.hoisted(() => ({
  createBinder: vi.fn<(make: {readerId: string; input: unknown}) => Promise<CreateResult>>(),
}));
vi.mock('./binderShelf', () => writes);

const OFFER: SaveOffer = {
  scope: WHOLE_COLLECTION,
  rules: 'ink=Amber&rarity=Epic',
  line: 'Amber ink · Epic',
  figures: {complete: 293, master: 120, cards: 625},
};
const MADE: Binder = {id: 'b9', name: 'Amber', scope: WHOLE_COLLECTION, rules: OFFER.rules, pages: 4, cover: null, place: 3};

function renderBox(over: Partial<SaveAsBinderProps> = {}) {
  const props: SaveAsBinderProps = {
    isOpen: true,
    offer: OFFER,
    readerId: 'user-1',
    isMobile: false,
    onSaved: vi.fn(),
    onMoreRules: vi.fn(),
    onClose: vi.fn(),
    onGone: vi.fn(),
    ...over,
  };
  render(<SaveAsBinder {...props} />);
  return props;
}

const nameField = () => screen.getByRole('textbox', {name: 'Name'});
const saveButton = () => screen.getByRole('button', {name: /^(Save binder|Saving…)$/});

describe('SaveAsBinder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    writes.createBinder.mockResolvedValue({binder: MADE});
  });

  it('suggests a name from its first rule, and says what it holds: its rules and Sets as chips, and its count', () => {
    renderBox();
    expect(screen.getByRole('dialog', {name: 'Save as a binder'})).toBeInTheDocument();
    expect(nameField()).toHaveValue('Amber');
    const chips = within(screen.getByRole('list', {name: 'Its rules'})).getAllByRole('listitem');
    expect(chips.map((chip) => chip.textContent)).toEqual(['Amber ink', 'Epic', 'All sets']);
    expect(screen.getByText('625 cards, you have 293, 46%')).toBeInTheDocument();
    expect(nameField().closest('.ph-no-capture')).not.toBeNull();
  });

  it('makes the binder at the Sets and rules offered, counts it by its rules, and hands it back', async () => {
    const props = renderBox();
    fireEvent.change(nameField(), {target: {value: '  Amber epics '}});
    await act(async () => fireEvent.click(saveButton()));
    expect(writes.createBinder).toHaveBeenCalledExactlyOnceWith({
      readerId: 'user-1',
      input: {name: 'Amber epics', scope: WHOLE_COLLECTION, rules: OFFER.rules, pages: 4, cover: null},
    });
    expect(trackEvent).toHaveBeenCalledExactlyOnceWith('binder_created', {from: 'saved', kinds: 'ink,rarity'});
    expect(props.onSaved).toHaveBeenCalledWith(MADE);
  });

  it('waits for a name', () => {
    renderBox();
    fireEvent.change(nameField(), {target: {value: '   '}});
    expect(saveButton()).toBeDisabled();
  });

  it('makes the binder at the page size picked under its name, 4 × 4 unless one is', async () => {
    renderBox();
    expect(screen.getByRole('button', {name: '4 × 4, 16 a page'})).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', {name: '2 × 2, 4 a page'}));
    await act(async () => fireEvent.click(saveButton()));
    expect(writes.createBinder).toHaveBeenCalledExactlyOnceWith({
      readerId: 'user-1',
      input: {name: 'Amber', scope: WHOLE_COLLECTION, rules: OFFER.rules, pages: 2, cover: null},
    });
  });

  it('hands More rules the name typed, the page size picked and the offer, for the window', () => {
    const props = renderBox();
    fireEvent.change(nameField(), {target: {value: 'Gold'}});
    fireEvent.click(screen.getByRole('button', {name: '3 × 3, 9 a page'}));
    fireEvent.click(screen.getByRole('button', {name: 'More rules'}));
    expect(props.onMoreRules).toHaveBeenCalledWith({name: 'Gold', scope: WHOLE_COLLECTION, rules: OFFER.rules, pages: 3});
  });

  it('holds while the save runs: More rules, Escape and the field all wait', async () => {
    let land!: (result: CreateResult) => void;
    writes.createBinder.mockReturnValue(new Promise((resolve) => (land = resolve)));
    const props = renderBox();
    await act(async () => fireEvent.click(saveButton()));
    expect(saveButton()).toHaveTextContent('Saving…');
    expect(screen.getByRole('button', {name: 'More rules'})).toBeDisabled();
    expect(nameField()).toBeDisabled();
    fireEvent.keyDown(screen.getByRole('dialog'), {key: 'Escape'});
    expect(props.onClose).not.toHaveBeenCalled();
    await act(async () => land({binder: MADE}));
  });

  it.each([
    ['full', 'Your shelf holds 30 binders'],
    ['failed', "Couldn't save the binder. Try again."],
  ] as const)('keeps the box and its name when the save comes back %s', async (problem, words) => {
    writes.createBinder.mockResolvedValue({problem});
    const props = renderBox();
    fireEvent.change(nameField(), {target: {value: 'Gold'}});
    await act(async () => fireEvent.click(saveButton()));
    expect(screen.getByRole('alert')).toHaveTextContent(words);
    expect(nameField()).toHaveValue('Gold');
    expect(props.onSaved).not.toHaveBeenCalled();
    expect(trackEvent).not.toHaveBeenCalled();
  });

  it('names its Sets chip by the set picked, and counts promos as promos', () => {
    renderBox({offer: {scope: 'P1', rules: 'ink=Ruby', line: 'Ruby ink · Promo 1', figures: {complete: 1, master: 0, cards: 1}}});
    const chips = within(screen.getByRole('list', {name: 'Its rules'})).getAllByRole('listitem');
    expect(chips.at(-1)?.textContent).toBe(scopeName('P1'));
    expect(screen.getByText(/^1 promo, you have 1, 100%$/)).toBeInTheDocument();
  });

  it("draws a phone's sheet", () => {
    renderBox({isMobile: true});
    expect(screen.getByRole('dialog', {name: 'Save as a binder'})).toHaveClass('overlay-slide-up');
  });
});
