import {afterEach, beforeAll, beforeEach, describe, it, expect, vi} from 'vitest';
import {act, fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import {MemoryRouter, useLocation} from 'react-router-dom';
import {trackEvent} from '../../../shared/lib/analytics';
import {createCard} from '../../../shared/test-utils';
import {BinderShelf} from './BinderShelf';
import type {Binder} from './binderRules';
import type {BinderShelf as Shelf} from './binderShelf';
import type {WindowAsk} from './useBinderWindow';

vi.mock('../../../shared/lib/analytics', () => ({trackEvent: vi.fn()}));
const writes = vi.hoisted(() => ({
  moveBinder: vi.fn<(move: {readerId: string; id: string; earlier: boolean}) => Promise<'moved' | 'unmoved' | 'failed'>>(),
  deleteBinder: vi.fn<(binder: {readerId: string; id: string}) => Promise<boolean>>(),
  updateBinder: vi.fn(),
  setCover: vi.fn(),
}));
vi.mock('./binderShelf', () => writes);
// The real faces, watched: the shelf must not work them out again on a render that changed none of their inputs.
const coverFaces = vi.hoisted(() => ({binderFace: vi.fn()}));
vi.mock('./binderCovers', async (actual) => {
  const real = await actual<typeof import('./binderCovers')>();
  coverFaces.binderFace.mockImplementation(real.binderFace);
  return {...real, binderFace: coverFaces.binderFace};
});

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

function renderShelf(
  shelf: Partial<Shelf> = {},
  more: {pool?: typeof POOL | null; waiting?: boolean; onWindow?: (ask: WindowAsk) => void} = {},
) {
  const retry = vi.fn();
  const view = render(
    <MemoryRouter initialEntries={['/browse?binder=shelf&ink=Steel']}>
      <BinderShelf
        shelf={{status: 'ready', binders: BINDERS, retry, ...shelf}}
        pool={more.pool === undefined ? POOL : more.pool}
        entries={ENTRIES}
        waiting={more.waiting ?? false}
        readerId="user-1"
        onWindow={more.onWindow ?? null}
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
  // Change cover is lazy: loaded here first, so a busy run's first transform never outlasts a find.
  beforeAll(async () => {
    await import('./CoverPicker');
  });

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

  it("gives every cover a ⋯, My collection's too, and keeps the whole shelf from autocapture", () => {
    const {view} = renderShelf();
    expect(screen.getAllByRole('button', {name: 'Actions'})).toHaveLength(4);
    expect(view.container.firstElementChild).toHaveClass('ph-no-capture');
  });

  it("offers Open and Change cover alone on My collection's ⋯", () => {
    renderShelf();
    fireEvent.click(menuOf('My collection'));
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual(['Open', 'Change cover']);
  });

  it("offers no Change cover after a failed read, which would leave the new cover nowhere to show", () => {
    renderShelf({status: 'failed', binders: []});
    fireEvent.click(menuOf('My collection'));
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual(['Open']);
  });

  it('counts My collection under the cover its shelf picked', () => {
    renderShelf({shelfCover: 'ruby'});
    expect(coverFaces.binderFace).toHaveBeenCalledWith(POOL, ENTRIES, null, 'ruby');
  });

  it("renames a binder from its ⋯, counts it by what changed, and closes once the server has it", async () => {
    writes.updateBinder.mockResolvedValue({binder: {...BINDERS[1], name: 'Reds'}});
    renderShelf();
    fireEvent.click(menuOf('Ruby'));
    fireEvent.click(screen.getByRole('menuitem', {name: 'Rename'}));
    const name = screen.getByRole('textbox', {name: 'Name'});
    expect(name).toHaveValue('Ruby');
    fireEvent.change(name, {target: {value: 'Reds'}});
    await act(async () => fireEvent.click(screen.getByRole('button', {name: 'Save'})));
    expect(writes.updateBinder).toHaveBeenCalledWith({readerId: 'user-1', id: 'b2', patch: {name: 'Reds'}});
    expect(trackEvent).toHaveBeenCalledWith('binder_changed', {what: 'name'});
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it("opens Change cover on a binder and on My collection, each titled by its name", async () => {
    renderShelf();
    fireEvent.click(menuOf('Ruby'));
    fireEvent.click(screen.getByRole('menuitem', {name: 'Change cover'}));
    expect(await screen.findByRole('heading', {name: 'Cover for Ruby'})).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: 'Cancel'}));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    fireEvent.click(menuOf('My collection'));
    fireEvent.click(screen.getByRole('menuitem', {name: 'Change cover'}));
    expect(await screen.findByRole('heading', {name: 'Cover for My collection'})).toBeInTheDocument();
  });

  it('never opens Change cover again by itself once the shelf stops counting while it is open', async () => {
    const {view} = renderShelf();
    fireEvent.click(menuOf('Ruby'));
    fireEvent.click(screen.getByRole('menuitem', {name: 'Change cover'}));
    expect(await screen.findByRole('heading', {name: 'Cover for Ruby'})).toBeInTheDocument();
    const shelfWaiting = (waiting: boolean) => (
      <MemoryRouter initialEntries={['/browse?binder=shelf']}>
        <BinderShelf
          shelf={{status: 'ready', binders: BINDERS, retry: vi.fn()}}
          pool={POOL}
          entries={ENTRIES}
          waiting={waiting}
          readerId="user-1"
          onWindow={null}
        />
      </MemoryRouter>
    );
    view.rerender(shelfWaiting(true));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    view.rerender(shelfWaiting(false));
    await act(async () => {});
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('draws a shimmer for My collection, and no link, while the cards, the account or the binders load', () => {
    for (const [shelf, more] of [
      [{}, {pool: null}],
      [{}, {waiting: true}],
      [{status: 'loading', binders: []}, {}],
      [{status: 'idle', binders: []}, {}],
    ] as const) {
      const {view} = renderShelf(shelf, more);
      expect(screen.queryAllByRole('link')).toHaveLength(0);
      expect(view.container.querySelectorAll('.react-loading-skeleton').length).toBeGreaterThan(0);
      view.unmount();
    }
  });

  it("works each cover's face out once, not again when the shelf opens its delete confirm", () => {
    renderShelf();
    expect(coverFaces.binderFace).toHaveBeenCalledTimes(4);
    // The confirm is the shelf's own state, so opening it renders the shelf again.
    fireEvent.click(menuOf('Amber'));
    fireEvent.click(screen.getByRole('menuitem', {name: 'Delete binder'}));
    expect(screen.getByRole('heading', {name: 'Delete Amber?'})).toBeInTheDocument();
    expect(coverFaces.binderFace).toHaveBeenCalledTimes(4);
  });

  it("says a failed read beside My collection, and its Try again reads again", () => {
    const {retry} = renderShelf({status: 'failed', binders: []});
    expect(covers()).toEqual(['My collection']);
    expect(screen.getByText("Couldn't load your binders.")).toHaveAttribute('role', 'status');
    fireEvent.click(screen.getByRole('button', {name: 'Try again'}));
    expect(retry).toHaveBeenCalledOnce();
  });

  it("moves a binder, counts it once it lands, and keeps focus on its ⋯", async () => {
    let land!: (result: 'moved') => void;
    writes.moveBinder.mockReturnValue(new Promise((resolve) => (land = resolve)));
    renderShelf();
    fireEvent.click(menuOf('Amber'));
    fireEvent.click(screen.getByRole('menuitem', {name: 'Move later'}));
    // Nothing is counted while the server has yet to answer.
    await act(async () => {});
    expect(trackEvent).not.toHaveBeenCalled();
    await act(async () => land('moved'));
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
    let land!: (deleted: boolean) => void;
    writes.deleteBinder.mockReturnValue(new Promise((resolve) => (land = resolve)));
    const {view} = renderShelf();
    fireEvent.click(menuOf('Ruby'));
    fireEvent.click(screen.getByRole('menuitem', {name: 'Delete binder'}));
    await act(async () => fireEvent.click(screen.getByRole('button', {name: 'Delete binder'})));
    // While the server has yet to answer, the confirm waits and nothing is counted.
    expect(screen.getByRole('button', {name: 'Deleting…'})).toBeDisabled();
    expect(trackEvent).not.toHaveBeenCalled();
    await act(async () => land(true));
    expect(writes.deleteBinder).toHaveBeenCalledWith({readerId: 'user-1', id: 'b2'});
    expect(trackEvent).toHaveBeenCalledWith('binder_deleted', {kinds: 'ink'});
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    // The store drops the row; the shelf draws what it's given.
    view.rerender(
      <MemoryRouter initialEntries={['/browse?binder=shelf']}>
        <BinderShelf
          shelf={{status: 'ready', binders: [BINDERS[0], BINDERS[2]], retry: vi.fn()}}
          pool={POOL}
          entries={ENTRIES}
          waiting={false}
          readerId="user-1"
          onWindow={null}
        />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByRole('link', {name: /^Rares,/})).toHaveFocus());
  });

  it('ends the shelf with New binder once it has read, and opens the window for a new binder', () => {
    const onWindow = vi.fn<(ask: WindowAsk) => void>();
    renderShelf({}, {onWindow});
    const tiles = screen.getAllByRole('listitem');
    expect(within(tiles[tiles.length - 1]).getByRole('button', {name: /^New binder/})).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: /^New binder/}));
    expect(onWindow).toHaveBeenCalledWith({binder: null, onSaved: expect.any(Function)});
  });

  it('offers no New binder until the window can open, the cards are in and the binders have read', () => {
    for (const [shelf, more] of [
      [{}, {}],
      [{}, {pool: null, onWindow: vi.fn()}],
      [{status: 'loading', binders: []}, {onWindow: vi.fn()}],
      [{status: 'failed', binders: []}, {onWindow: vi.fn()}],
    ] as const) {
      const {view} = renderShelf(shelf, more);
      expect(screen.queryByRole('button', {name: /^New binder/})).toBeNull();
      view.unmount();
    }
  });

  it('says why there is no New binder once the shelf holds 30', () => {
    const thirty = Array.from({length: 30}, (_, place) => binder(`b${place}`, `Binder ${place}`, 'ink=Amber', place));
    renderShelf({binders: thirty}, {onWindow: vi.fn()});
    expect(screen.queryByRole('button', {name: /^New binder/})).toBeNull();
    expect(screen.getByText('Your shelf holds 30 binders, the most it can. Delete one to make another.')).toBeInTheDocument();
  });

  it('hands focus to the new cover once the window saves a binder', async () => {
    const onWindow = vi.fn<(ask: WindowAsk) => void>();
    const {view} = renderShelf({}, {onWindow});
    fireEvent.click(screen.getByRole('button', {name: /^New binder/}));
    const made = binder('b4', 'Sapphire', 'ink=Sapphire', 3);
    // The store adds the row; the shelf draws what it's given, then the window says it saved.
    view.rerender(
      <MemoryRouter initialEntries={['/browse?binder=shelf']}>
        <BinderShelf
          shelf={{status: 'ready', binders: [...BINDERS, made], retry: vi.fn()}}
          pool={POOL}
          entries={ENTRIES}
          waiting={false}
          readerId="user-1"
          onWindow={onWindow}
        />
      </MemoryRouter>,
    );
    act(() => onWindow.mock.calls[0][0].onSaved(made));
    await waitFor(() => expect(screen.getByRole('link', {name: /^Sapphire,/})).toHaveFocus());
  });

  it('opens the window on a binder from its Edit rules, and keeps focus on its ⋯ once it saves', async () => {
    const onWindow = vi.fn<(ask: WindowAsk) => void>();
    renderShelf({}, {onWindow});
    fireEvent.click(menuOf('Ruby'));
    fireEvent.click(screen.getByRole('menuitem', {name: 'Edit rules'}));
    const [ask] = onWindow.mock.calls[0];
    expect(ask.binder).toBe(BINDERS[1]);
    screen.getByRole('link', {name: /^Amber,/}).focus();
    act(() => ask.onSaved(BINDERS[1]));
    await waitFor(() => expect(menuOf('Ruby')).toHaveFocus());
  });

  it('offers no Edit rules while the window cannot open', () => {
    renderShelf();
    fireEvent.click(menuOf('Ruby'));
    expect(screen.queryByRole('menuitem', {name: 'Edit rules'})).toBeNull();
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
