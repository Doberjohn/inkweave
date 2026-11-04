import {describe, expect, it, vi, beforeEach} from 'vitest';
import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {trackEvent} from '../../../shared/lib/analytics';
import type {CollectionEntries} from '../collectionParser';
import type {BinderChoices} from './binderChoices';
import type {Binder} from './binderRules';
import {BinderList} from './BinderTab';

vi.mock('../../../shared/lib/analytics', () => ({trackEvent: vi.fn()}));

const cardOf = (facts: Partial<LorcanaCard> & Pick<LorcanaCard, 'id'>) =>
  ({name: facts.id, fullName: facts.id, cost: 1, ink: 'Amber', inkwell: true, type: 'Character', rarity: 'Common', setCode: '12', setNumber: 1, ...facts}) as LorcanaCard;

const POOL = [
  cardOf({id: 'amber-common', setNumber: 3}),
  cardOf({id: 'amber-rare', rarity: 'Rare', setNumber: 40, imageUrl: 'https://art.test/amber-rare.avif'}),
  cardOf({id: 'steel-epic', ink: 'Steel', rarity: 'Epic', setCode: '11', setNumber: 210}),
  cardOf({id: 'steel-common', ink: 'Steel', setCode: '11', setNumber: 8}),
];
// Held: both Amber cards and the Steel Epic, so My collection is 3 of 4 and Amber 2 of 2.
const ENTRIES: CollectionEntries = {
  'amber-common': {normal: 1, foil: 0},
  'amber-rare': {normal: 1, foil: 0},
  'steel-epic': {normal: 0, foil: 1},
};

const AMBER: Binder = {id: 'b1', name: 'Amber', scope: 'all', rules: 'ink=Amber', coverId: null, place: 0};
const WILDS: Binder = {id: 'b2', name: 'Wilds epics', scope: '11', rules: 'rarity=Epic', coverId: null, place: 1};
const SAPPHIRE: Binder = {id: 'b3', name: 'Sapphire', scope: 'all', rules: 'ink=Sapphire', coverId: null, place: 2};

function renderList(over: Partial<BinderChoices> = {}) {
  const choices: BinderChoices = {
    open: null,
    atOwnScope: true,
    shelf: {status: 'ready', binders: [AMBER, WILDS], retry: vi.fn()},
    pool: POOL,
    entries: ENTRIES,
    onOpen: vi.fn(),
    onShelf: vi.fn(),
    onNewBinder: vi.fn(),
    ...over,
  };
  const onPicked = vi.fn();
  render(<BinderList choices={choices} onPicked={onPicked} />);
  return {...choices, onPicked};
}

const openAmber = {binder: AMBER, cover: POOL[1], narrowed: true};
const row = (name: RegExp) => screen.getByRole('option', {name});

beforeEach(() => {
  vi.mocked(trackEvent).mockClear();
});

describe('BinderList', () => {
  it('lists All your binders, My collection, each binder in shelf order, each named by its words, then New binder', () => {
    renderList();
    const rows = screen.getAllByRole('option');
    expect(rows.map((option) => option.textContent)).toEqual([
      'All your binders3All your binders, 3 binders',
      'My collection75%My collection, 75% complete',
      'Amber100%Amber, 100% complete',
      'Wilds epics100%Wilds epics, 100% complete',
      'New binder',
    ]);
    expect(rows[2]).toHaveAccessibleName('Amber, 100% complete');
  });

  // A binder's name is the player's own words: never in an attribute, never in autocapture.
  it("keeps every binder's name out of its attributes and PostHog's autocapture", () => {
    renderList();
    for (const option of screen.getAllByRole('option')) {
      expect(option).not.toHaveAttribute('aria-label');
      expect(option).not.toHaveAttribute('title');
      expect(option).toHaveClass('ph-no-capture');
    }
  });

  it("chooses the open binder, My collection when none is, and draws each binder's cover", () => {
    renderList({open: openAmber});
    expect(row(/^Amber,/)).toHaveAttribute('aria-selected', 'true');
    expect(row(/^My collection,/)).toHaveAttribute('aria-selected', 'false');
    expect(row(/^Amber,/).querySelector('img')).toHaveAttribute('src', 'https://art.test/amber-rare-sm.avif');
  });

  it('shows a dash for a binder whose rules hold no card', () => {
    renderList({shelf: {status: 'ready', binders: [SAPPHIRE], retry: vi.fn()}});
    expect(row(/^Sapphire/)).toHaveAccessibleName('Sapphire, no cards');
    expect(row(/^Sapphire/)).toHaveTextContent(/^Sapphire–Sapphire, no cards$/);
  });

  it('shows no percentage while the pool loads', () => {
    renderList({pool: null});
    expect(row(/^Amber/)).toHaveAccessibleName('Amber');
  });

  it('opens a binder of your own, counting the kinds of its rules but never its name', () => {
    const {onOpen, onPicked} = renderList();
    fireEvent.click(row(/^Wilds epics,/));
    expect(onOpen).toHaveBeenCalledWith(WILDS);
    expect(onPicked).toHaveBeenCalledOnce();
    expect(vi.mocked(trackEvent).mock.calls).toEqual([['binder_opened', {from: 'picker', mine: true, kinds: 'sets,rarity'}]]);
  });

  it('opens My collection from a binder, counted as none of yours', () => {
    const {onOpen} = renderList({open: openAmber});
    fireEvent.click(row(/^My collection,/));
    expect(onOpen).toHaveBeenCalledWith(null);
    expect(trackEvent).toHaveBeenCalledWith('binder_opened', {from: 'picker', mine: false, kinds: 'none'});
  });

  it('only closes for the binder on show at its own Sets, and takes a set picked inside it back to them', () => {
    const atOwn = renderList({open: openAmber});
    fireEvent.click(row(/^Amber,/));
    expect(atOwn.onOpen).not.toHaveBeenCalled();
    expect(trackEvent).not.toHaveBeenCalled();
    expect(atOwn.onPicked).toHaveBeenCalledOnce();

    cleanup();
    const inside = renderList({open: openAmber, atOwnScope: false});
    fireEvent.click(row(/^Amber,/));
    expect(inside.onOpen).toHaveBeenCalledWith(AMBER);
  });

  it('holds a shimmer under My collection while the binders load, and no count on All your binders', () => {
    renderList({shelf: {status: 'loading', binders: [], retry: vi.fn()}});
    expect(screen.getAllByRole('option')).toHaveLength(2);
    expect(row(/^All your binders/)).toHaveAccessibleName('All your binders');
    expect(screen.getByRole('listbox').querySelector('.react-loading-skeleton')).not.toBeNull();
  });

  // The shelf is a push: Back returns to the binder it was opened from.
  it('opens the shelf from All your binders, counting no binder opened', () => {
    const {onShelf, onOpen, onPicked} = renderList({open: openAmber});
    expect(row(/^All your binders/)).toHaveAttribute('aria-selected', 'false');
    fireEvent.click(row(/^All your binders/));
    expect(onShelf).toHaveBeenCalledOnce();
    expect(onOpen).not.toHaveBeenCalled();
    expect(onPicked).toHaveBeenCalledOnce();
    expect(trackEvent).not.toHaveBeenCalled();
  });

  it('counts My collection on All your binders: "1 binder" with none of your own', () => {
    renderList({shelf: {status: 'ready', binders: [], retry: vi.fn()}});
    expect(row(/^All your binders/)).toHaveAccessibleName('All your binders, 1 binder');
  });

  it('closes the menu and opens the New binder window from New binder, counting nothing yet', () => {
    const {onNewBinder, onPicked} = renderList();
    fireEvent.click(row(/^New binder$/));
    expect(onPicked).toHaveBeenCalledOnce();
    expect(onNewBinder).toHaveBeenCalledOnce();
    expect(trackEvent).not.toHaveBeenCalled();
  });

  it('says why there is no New binder once the shelf holds 30', () => {
    const thirty = Array.from({length: 30}, (_, place) => ({...AMBER, id: `b${place}`, place}));
    renderList({shelf: {status: 'ready', binders: thirty, retry: vi.fn()}, pool: null});
    expect(screen.queryByRole('option', {name: 'New binder'})).toBeNull();
    expect(screen.getByText('Your shelf holds 30 binders, the most it can. Delete one to make another.')).toBeInTheDocument();
  });

  it('says a failed read, and its Try again reads again', () => {
    const retry = vi.fn();
    renderList({shelf: {status: 'failed', binders: [], retry}});
    expect(screen.getByRole('status')).toHaveTextContent("Couldn't load your binders.");
    fireEvent.click(screen.getByRole('button', {name: 'Try again'}));
    expect(retry).toHaveBeenCalledOnce();
  });
});
