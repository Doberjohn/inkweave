import {beforeEach, describe, expect, it, vi} from 'vitest';
import {act, fireEvent, render, screen, within} from '@testing-library/react';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {trackEvent} from '../../../shared/lib/analytics';
import type {CollectionEntries} from '../collectionParser';
import {binderFace} from './binderCovers';
import type {Binder} from './binderRules';
import type {CoverResult} from './binderShelf';
import {COVER_PAGE, CoverPicker, type CoverPickerProps} from './CoverPicker';

vi.mock('../../../shared/lib/analytics', () => ({trackEvent: vi.fn()}));
const writes = vi.hoisted(() => ({
  setCover: vi.fn<(change: {readerId: string; id: string | null; coverId: string | null}) => Promise<CoverResult>>(),
}));
vi.mock('./binderShelf', () => writes);

const cardOf = (facts: Partial<LorcanaCard> & Pick<LorcanaCard, 'id'>) =>
  ({
    name: facts.id,
    fullName: facts.id,
    cost: 1,
    ink: 'Amber',
    inkwell: true,
    type: 'Character',
    rarity: 'Common',
    setCode: '12',
    setNumber: 1,
    imageUrl: `/card-images/${facts.id}.avif`,
    ...facts,
  }) as LorcanaCard;

const POOL = [
  cardOf({id: 'elsa-common', fullName: 'Elsa - Snow Queen', setNumber: 3}),
  cardOf({id: 'moana-epic', fullName: 'Moana - Of Motunui', rarity: 'Epic', setNumber: 210}),
  cardOf({id: 'elsa-legend', fullName: 'Elsa - Spirit of Winter', rarity: 'Legendary', setNumber: 40}),
  cardOf({id: 'steel-rare', fullName: 'Hercules - Hero', ink: 'Steel', rarity: 'Rare', setCode: '11', setNumber: 8}),
  cardOf({id: 'amber-unheld', fullName: 'Stitch - Rock Star', rarity: 'Enchanted', setNumber: 220}),
];
const ENTRIES: CollectionEntries = {
  'elsa-common': {normal: 1, foil: 0},
  'moana-epic': {normal: 0, foil: 1},
  'elsa-legend': {normal: 2, foil: 0},
  'steel-rare': {normal: 1, foil: 0},
};

const AMBER: Binder = {id: 'b1', name: 'Amber', scope: 'all', rules: 'ink=Amber', coverId: null, place: 0};

function renderPicker(over: Partial<CoverPickerProps> = {}) {
  const props: CoverPickerProps = {
    isOpen: true,
    binder: AMBER,
    shelfCover: null,
    pool: POOL,
    entries: ENTRIES,
    readerId: 'user-1',
    isMobile: false,
    onSaved: vi.fn(),
    onClose: vi.fn(),
    onGone: vi.fn(),
    ...over,
  };
  render(<CoverPicker {...props} />);
  return props;
}

const cards = () => within(screen.getByRole('list', {name: 'Your cards'})).getAllByRole('button');
const cardNames = () => cards().map((button) => within(button).getByRole('img').getAttribute('alt'));
const rarest = () => screen.getByRole('button', {name: /^The rarest card you have/});
const card = (name: string) => screen.getByRole('button', {name});

describe('CoverPicker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    writes.setCover.mockResolvedValue('set');
  });

  it("is titled by the binder's name, which stays out of the dialog's own name", () => {
    renderPicker();
    expect(screen.getByRole('dialog', {name: 'Change cover'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Cover for Amber'}).closest('.ph-no-capture')).not.toBeNull();
  });

  it("offers the cards the binder holds that you have, in the cover's own order, the rarest first", () => {
    renderPicker();
    expect(cardNames()).toEqual(['Moana - Of Motunui', 'Elsa - Spirit of Winter', 'Elsa - Snow Queen']);
    // The first is the card the cover picks itself, which The rarest card you have shows.
    expect(binderFace(POOL, ENTRIES, AMBER).cover?.fullName).toBe('Moana - Of Motunui');
    expect(rarest()).toHaveTextContent('Moana - Of Motunui');
    expect(rarest()).toHaveAttribute('aria-pressed', 'true');
  });

  it('marks the card picked, and not the rarest', () => {
    renderPicker({binder: {...AMBER, coverId: 'elsa-common'}});
    expect(card('Elsa - Snow Queen')).toHaveAttribute('aria-pressed', 'true');
    expect(rarest()).toHaveAttribute('aria-pressed', 'false');
  });

  it('narrows the cards by name as Find a card is typed', () => {
    renderPicker();
    fireEvent.change(screen.getByRole('searchbox', {name: 'Find a card'}), {target: {value: 'elsa'}});
    expect(cardNames()).toEqual(['Elsa - Spirit of Winter', 'Elsa - Snow Queen']);
    fireEvent.change(screen.getByRole('searchbox', {name: 'Find a card'}), {target: {value: 'zzz'}});
    expect(screen.getByText('None of your cards here match.')).toBeInTheDocument();
  });

  it('shows 40 at a time, and Show more adds 40 and hands focus to the first it adds', () => {
    const many = Array.from({length: COVER_PAGE + 5}, (_, at) => cardOf({id: `c${at}`, fullName: `Card ${at}`, setNumber: at + 1}));
    renderPicker({binder: null, pool: many, entries: Object.fromEntries(many.map((one) => [one.id, {normal: 1, foil: 0}]))});
    expect(cards()).toHaveLength(COVER_PAGE);
    fireEvent.click(screen.getByRole('button', {name: 'Show more'}));
    expect(cards()).toHaveLength(COVER_PAGE + 5);
    expect(cards()[COVER_PAGE]).toHaveFocus();
    expect(screen.queryByRole('button', {name: 'Show more'})).toBeNull();
  });

  it('hands focus on again after a search starts the cards over', () => {
    const many = Array.from({length: COVER_PAGE + 5}, (_, at) => cardOf({id: `c${at}`, fullName: `Card ${at}`, setNumber: at + 1}));
    renderPicker({binder: null, pool: many, entries: Object.fromEntries(many.map((one) => [one.id, {normal: 1, foil: 0}]))});
    fireEvent.click(screen.getByRole('button', {name: 'Show more'}));
    const find = screen.getByRole('searchbox', {name: 'Find a card'});
    fireEvent.change(find, {target: {value: 'card'}});
    find.focus();
    fireEvent.click(screen.getByRole('button', {name: 'Show more'}));
    expect(cards()[COVER_PAGE]).toHaveFocus();
  });

  it("saves a pick, counts the change by what changed, and tells the shelf once it lands", async () => {
    const props = renderPicker();
    await act(async () => fireEvent.click(card('Elsa - Snow Queen')));
    expect(writes.setCover).toHaveBeenCalledExactlyOnceWith({readerId: 'user-1', id: 'b1', coverId: 'elsa-common'});
    expect(trackEvent).toHaveBeenCalledExactlyOnceWith('binder_changed', {what: 'cover'});
    expect(props.onSaved).toHaveBeenCalledOnce();
  });

  it("clears a saved card the binder's rules no longer hold, though the rarest already shows", async () => {
    renderPicker({binder: {...AMBER, coverId: 'steel-rare'}});
    expect(rarest()).toHaveAttribute('aria-pressed', 'true');
    await act(async () => fireEvent.click(rarest()));
    expect(writes.setCover).toHaveBeenCalledExactlyOnceWith({readerId: 'user-1', id: 'b1', coverId: null});
  });

  it('puts the rarest back with no card picked', async () => {
    renderPicker({binder: {...AMBER, coverId: 'elsa-common'}});
    await act(async () => fireEvent.click(rarest()));
    expect(writes.setCover).toHaveBeenCalledWith({readerId: 'user-1', id: 'b1', coverId: null});
  });

  it('only closes when the cover picked is the one it has', () => {
    const props = renderPicker();
    fireEvent.click(rarest());
    expect(writes.setCover).not.toHaveBeenCalled();
    expect(props.onSaved).toHaveBeenCalledOnce();
  });

  it('holds while the pick saves: every choice and Cancel wait, and Escape does nothing', async () => {
    let land!: (result: CoverResult) => void;
    writes.setCover.mockReturnValue(new Promise((resolve) => (land = resolve)));
    const props = renderPicker();
    await act(async () => fireEvent.click(card('Elsa - Snow Queen')));
    expect(screen.getByRole('status')).toHaveTextContent('Saving…');
    expect(rarest()).toBeDisabled();
    expect(screen.getByRole('button', {name: 'Cancel'})).toBeDisabled();
    fireEvent.keyDown(screen.getByRole('dialog'), {key: 'Escape'});
    expect(props.onClose).not.toHaveBeenCalled();
    await act(async () => land('set'));
  });

  it.each([
    ['failed', "Couldn't change the cover. Try again."],
    ['gone', "This binder isn't on your shelf anymore."],
  ] as const)('stays open and says so when the save comes back %s', async (result, words) => {
    writes.setCover.mockResolvedValue(result);
    const props = renderPicker();
    await act(async () => fireEvent.click(card('Elsa - Snow Queen')));
    expect(screen.getByRole('alert')).toHaveTextContent(words);
    expect(props.onSaved).not.toHaveBeenCalled();
    expect(trackEvent).not.toHaveBeenCalled();
  });

  it("changes My collection's cover over every card you have, marked from the shelf's own", async () => {
    renderPicker({binder: null, shelfCover: 'steel-rare'});
    expect(screen.getByRole('heading', {name: 'Cover for My collection'})).toBeInTheDocument();
    expect(cardNames()).toContain('Hercules - Hero');
    expect(card('Hercules - Hero')).toHaveAttribute('aria-pressed', 'true');
    await act(async () => fireEvent.click(card('Elsa - Snow Queen')));
    expect(writes.setCover).toHaveBeenCalledWith({readerId: 'user-1', id: null, coverId: 'elsa-common'});
  });

  it('says a binder holding none of your cards, with The rarest card you have alone', () => {
    renderPicker({entries: {}});
    expect(screen.getByText('You have none of its cards yet.')).toBeInTheDocument();
    expect(rarest()).toHaveTextContent('None of its cards yet');
    expect(screen.queryByRole('searchbox')).toBeNull();
  });

  it("draws a phone's sheet", () => {
    renderPicker({isMobile: true});
    expect(screen.getByRole('dialog', {name: 'Change cover'})).toHaveClass('overlay-slide-up');
  });
});
