import {describe, expect, it, vi} from 'vitest';
import {fireEvent, render, screen, within} from '@testing-library/react';
import {createMemoryRouter, RouterProvider} from 'react-router-dom';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {createCard} from '../../shared/test-utils';
import type {CollectionEntry, Finish} from './collectionParser';
import type {SharingFriend} from './friendsCopies';
import type {FriendsFor} from './friendsHave';
import {FriendsWhoHaveIt} from './FriendsWhoHaveIt';

const CARD = createCard({id: 'c1', name: 'Goliath', version: 'Clan Leader', setCode: '9', setNumber: 30, rarity: 'Rare'});
const BOTH: Finish[] = ['normal', 'foil'];

const friend = (name: string, handle: string | null): SharingFriend => ({id: name, name, handle, entries: {}});
const RUBY = friend('Ruby Hero 042', 'ruby_hero_042');
const EMERALD = friend('Emerald Fairy 913', 'emerald_fairy_913');
const NAMELESS = friend('Inkweave player', null);

const MISSING: FriendsFor = {
  lacked: BOTH,
  friends: [
    {friend: EMERALD, normal: 3, foil: 1},
    {friend: RUBY, normal: 2, foil: 0},
  ],
};

interface Options {
  card?: LorcanaCard;
  have?: FriendsFor;
  held?: CollectionEntry;
  notSharing?: number;
  isMobile?: boolean;
  onClose?: () => void;
  onFollow?: () => void;
}

/** The dialog over a page, in a data router, so a row's link can be followed. */
function renderDialog({card = CARD, have = MISSING, held = {normal: 0, foil: 0}, notSharing = 0, isMobile = false, onClose = vi.fn(), onFollow = vi.fn()}: Options = {}) {
  const dialog = (
    <FriendsWhoHaveIt
      isOpen
      onClose={onClose}
      card={card}
      finishes={BOTH}
      held={held}
      have={have}
      notSharing={notSharing}
      isMobile={isMobile}
      onFollow={onFollow}
    />
  );
  const router = createMemoryRouter([
    {path: '/', element: dialog},
    {path: '/browse', element: <p>The friend's binder</p>},
  ]);
  render(<RouterProvider router={router} />);
  return router;
}

const whoHasIt = () => screen.getByRole('dialog', {name: 'Friends who have it'});

describe('FriendsWhoHaveIt', () => {
  it('lists each friend as a link to their binder on the card, named with their copies', () => {
    renderDialog();
    const links = within(whoHasIt()).getAllByRole('link');
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/browse?binder=9&friend=emerald_fairy_913',
      '/browse?binder=9&friend=ruby_hero_042',
    ]);
    expect(links[0]).toHaveAccessibleName('Emerald Fairy 913: 3 normal, 1 foil. Open their binder');
    expect(links[1]).toHaveAccessibleName('Ruby Hero 042: 2 normal, 0 foil. Open their binder');
  });

  it("links an edition's card to the binder of the promo set that gathers it", () => {
    renderDialog({card: createCard({id: 'cc1-3', name: 'Belle', setCode: 'CC1', setNumber: 3, rarity: 'Rare'})});
    expect(within(whoHasIt()).getAllByRole('link')[0]).toHaveAttribute('href', '/browse?binder=CC&friend=emerald_fairy_913');
  });

  it("opens the friend's binder at the card, says it came from here, and hands the follow back to close the window", async () => {
    const onFollow = vi.fn();
    const router = renderDialog({onFollow});
    fireEvent.click(within(whoHasIt()).getAllByRole('link')[1]);
    expect(onFollow).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("The friend's binder")).toBeInTheDocument();
    expect(router.state.location.state).toEqual({atCard: 'c1', binderFrom: 'friends_who_have_it'});
  });

  it('leaves the window open when a row opens the binder in a new tab', () => {
    const onFollow = vi.fn();
    renderDialog({onFollow});
    fireEvent.click(within(whoHasIt()).getAllByRole('link')[0], {ctrlKey: true});
    expect(onFollow).not.toHaveBeenCalled();
  });

  it('says what the reader holds of the card', () => {
    renderDialog();
    expect(within(whoHasIt()).getByText("You're missing it")).toBeInTheDocument();
  });

  it('counts only the finish the reader lacks, and says what they hold', () => {
    renderDialog({held: {normal: 1, foil: 0}, have: {lacked: ['foil'], friends: [{friend: RUBY, normal: 0, foil: 1}]}});
    const dialog = whoHasIt();
    expect(within(dialog).getByText('You have 1 normal · missing the foil')).toBeInTheDocument();
    expect(within(dialog).getByRole('heading', {name: '1 friend has the foil'})).toBeInTheDocument();
    expect(within(dialog).getByRole('link')).toHaveAccessibleName('Ruby Hero 042: 1 foil. Open their binder');
  });

  it('lists a friend with no public name with their copies, and links nowhere', () => {
    renderDialog({have: {lacked: BOTH, friends: [{friend: NAMELESS, normal: 1, foil: 0}]}});
    const dialog = whoHasIt();
    expect(within(dialog).queryByRole('link')).toBeNull();
    expect(within(dialog).getByText('Inkweave player: 1 normal, 0 foil.')).toBeInTheDocument();
  });

  it("says how many friends don't share", () => {
    renderDialog({notSharing: 3});
    expect(screen.getByText("3 friends don't share their collection, so they aren't counted.")).toBeInTheDocument();
  });

  it('keeps the friends out of PostHog', () => {
    renderDialog();
    expect(within(whoHasIt()).getByRole('list')).toHaveClass('ph-no-capture');
  });

  it('takes Escape for itself, so the card window under it stays open', () => {
    const onClose = vi.fn();
    const windowEscape = vi.fn();
    document.addEventListener('keydown', windowEscape);
    renderDialog({onClose});
    fireEvent.keyDown(document.activeElement ?? document.body, {key: 'Escape'});
    document.removeEventListener('keydown', windowEscape);
    expect(onClose).toHaveBeenCalled();
    expect(windowEscape).not.toHaveBeenCalled();
  });

  it('is a sheet on a phone, with the same rows', () => {
    renderDialog({isMobile: true});
    expect(within(whoHasIt()).getAllByRole('link')).toHaveLength(2);
    expect(within(whoHasIt()).getByRole('button', {name: 'Close'})).toBeInTheDocument();
  });
});
