import {afterEach, beforeEach, describe, it, expect, vi} from 'vitest';
import {act, fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import {MemoryRouter, useLocation} from 'react-router-dom';
import {trackEvent} from '../../../shared/lib/analytics';
import {createCard} from '../../../shared/test-utils';
import {BinderShelf} from './BinderShelf';
import type {Binder} from './binderRules';
import type {BinderShelf as Shelf} from './binderShelf';

vi.mock('../../../shared/lib/analytics', () => ({trackEvent: vi.fn()}));
const writes = vi.hoisted(() => ({
  moveBinder: vi.fn<(move: {readerId: string; id: string; earlier: boolean}) => Promise<'moved' | 'unmoved' | 'failed'>>(),
  deleteBinder: vi.fn<(binder: {readerId: string; id: string}) => Promise<boolean>>(),
}));
vi.mock('./binderShelf', () => writes);

const amber = createCard({id: 'amber', setCode: '14', setNumber: 1, rarity: 'Uncommon', ink: 'Amber'});
const ruby = createCard({id: 'ruby', setCode: '14', setNumber: 2, rarity: 'Rare', ink: 'Ruby'});
const POOL = [amber, ruby];
const ENTRIES = {amber: {normal: 1, foil: 0}};

const binder = (id: string, name: string, rules: string, place: number): Binder => ({id, name, scope: 'all', rules, coverId: null, place});
const BINDERS = [binder('b1', 'Amber', 'ink=Amber', 0), binder('b2', 'Ruby', 'ink=Ruby', 1), binder('b3', 'Rares', 'rarity=Rare', 2)];

function Address() {
  const {search} = useLocation();
  return <output data-testid="search">{search}</output>;
}

function renderShelf(shelf: Partial<Shelf> = {}, more: {pool?: typeof POOL | null; waiting?: boolean} = {}) {
  const retry = vi.fn();
  const view = render(
    <MemoryRouter initialEntries={['/browse?binder=shelf&ink=Steel']}>
      <BinderShelf
        shelf={{status: 'ready', binders: BINDERS, retry, ...shelf}}
        pool={more.pool === undefined ? POOL : more.pool}
        entries={ENTRIES}
        waiting={more.waiting ?? false}
        readerId="user-1"
      />
      <Address />
    </MemoryRouter>,
  );
  return {retry, view};
}

/** Each cover's binder name, from the words that name its link (the drawn ones are hidden). */
const covers = () =>
  screen.getAllByRole('link').map((link) => link.querySelector(':scope > :not([aria-hidden])')?.textContent?.split(',')[0]);
const menuOf = (name: string) => {
  const tile = screen.getByRole('link', {name: new RegExp(`^${name},`)}).parentElement!;
  return within(tile).getByRole('button', {name: 'Actions'});
};

describe('BinderShelf', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    writes.moveBinder.mockResolvedValue('moved');
    writes.deleteBinder.mockResolvedValue(true);
  });
  afterEach(() => vi.useRealTimers());

  it('shows My collection, then each binder in place order, each linking to it with the filters cleared', () => {
    renderShelf();
    expect(covers()).toEqual(['My collection', 'Amber', 'Ruby', 'Rares']);
    expect(screen.getByRole('link', {name: /^My collection, Every card, 50%, 1 of 2 cards$/})).toHaveAttribute('href', '/browse?binder=all');
    expect(screen.getByRole('link', {name: /^Amber,/})).toHaveAttribute('href', '/browse?binder=all&custom=b1');
  });

  it('counts the opening of a cover by its rules, never its name', () => {
    renderShelf();
    fireEvent.click(screen.getByRole('link', {name: /^Ruby,/}));
    expect(trackEvent).toHaveBeenCalledWith('binder_opened', {from: 'shelf', mine: true, kinds: 'ink'});
    fireEvent.click(screen.getByRole('link', {name: /^My collection,/}));
    expect(trackEvent).toHaveBeenLastCalledWith('binder_opened', {from: 'shelf', mine: false, kinds: 'none'});
  });

  it('gives your binders a ⋯ and My collection none, and keeps the whole shelf from autocapture', () => {
    const {view} = renderShelf();
    expect(screen.getAllByRole('button', {name: 'Actions'})).toHaveLength(3);
    expect(view.container.firstElementChild).toHaveClass('ph-no-capture');
  });

  it('draws a shimmer for My collection, and no link, while the cards or the account load', () => {
    renderShelf({status: 'loading', binders: []}, {pool: null});
    expect(screen.queryAllByRole('link')).toHaveLength(0);
    renderShelf({}, {waiting: true});
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });

  it("says a failed read beside My collection, and its Try again reads again", () => {
    const {retry} = renderShelf({status: 'failed', binders: []});
    expect(covers()).toEqual(['My collection']);
    expect(screen.getByText("Couldn't load your binders.")).toHaveAttribute('role', 'status');
    fireEvent.click(screen.getByRole('button', {name: 'Try again'}));
    expect(retry).toHaveBeenCalledOnce();
  });

  it("moves a binder, counts it once it lands, and keeps focus on its ⋯", async () => {
    renderShelf();
    fireEvent.click(menuOf('Amber'));
    fireEvent.click(screen.getByRole('menuitem', {name: 'Move later'}));
    await waitFor(() => expect(trackEvent).toHaveBeenCalledWith('binder_changed', {what: 'place'}));
    expect(writes.moveBinder).toHaveBeenCalledWith({readerId: 'user-1', id: 'b1', earlier: false});
    expect(menuOf('Amber')).toHaveFocus();
  });

  it('says a failed move under its cover, and counts nothing', async () => {
    writes.moveBinder.mockResolvedValue('failed');
    renderShelf();
    fireEvent.click(menuOf('Ruby'));
    fireEvent.click(screen.getByRole('menuitem', {name: 'Move earlier'}));
    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't move it. Try again.");
    expect(trackEvent).not.toHaveBeenCalled();
  });

  it('deletes nothing before the confirm, and Keep it deletes nothing', () => {
    renderShelf();
    fireEvent.click(menuOf('Ruby'));
    fireEvent.click(screen.getByRole('menuitem', {name: 'Delete binder'}));
    expect(screen.getByRole('heading', {name: 'Delete Ruby?'})).toBeInTheDocument();
    expect(writes.deleteBinder).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', {name: 'Keep it'}));
    expect(writes.deleteBinder).not.toHaveBeenCalled();
  });

  it('deletes once confirmed, counts it by its rules, and hands focus to the next cover', async () => {
    const {view} = renderShelf();
    fireEvent.click(menuOf('Ruby'));
    fireEvent.click(screen.getByRole('menuitem', {name: 'Delete binder'}));
    await act(async () => fireEvent.click(screen.getByRole('button', {name: 'Delete binder'})));
    expect(writes.deleteBinder).toHaveBeenCalledWith({readerId: 'user-1', id: 'b2'});
    expect(trackEvent).toHaveBeenCalledWith('binder_deleted', {kinds: 'ink'});
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    // The store drops the row; the shelf draws what it's given.
    view.rerender(
      <MemoryRouter initialEntries={['/browse?binder=shelf']}>
        <BinderShelf shelf={{status: 'ready', binders: [BINDERS[0], BINDERS[2]], retry: vi.fn()}} pool={POOL} entries={ENTRIES} waiting={false} readerId="user-1" />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByRole('link', {name: /^Rares,/})).toHaveFocus());
  });

  it("keeps the confirm open with its line when the delete fails", async () => {
    writes.deleteBinder.mockResolvedValue(false);
    renderShelf();
    fireEvent.click(menuOf('Rares'));
    fireEvent.click(screen.getByRole('menuitem', {name: 'Delete binder'}));
    await act(async () => fireEvent.click(screen.getByRole('button', {name: 'Delete binder'})));
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't delete it. Try again.");
    expect(trackEvent).not.toHaveBeenCalled();
  });
});
