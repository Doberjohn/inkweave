import {act, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {FriendsSection, type FriendsSectionProps} from './FriendsSection';
import type {FriendRow, SendOutcome} from './useFriends';

const person = (id: string, name: string, since: string | null = null): FriendRow => ({
  id,
  name,
  handle: name.toLowerCase().replaceAll(' ', '_'),
  since,
  pair: {requesterId: id, addresseeId: 'me'},
});
const RUBY = person('ruby', 'Ruby Hero 042');
const SAPPHIRE = person('sapphire', 'Sapphire Dragon 204');
// A request the player sent, so the pair runs from them to Steel.
const STEEL = {...person('steel', 'Steel Pirate 777'), pair: {requesterId: 'me', addresseeId: 'steel'}};
const AMBER = person('amber', 'Amber Toy 115', '2026-10-19T09:00:00Z');
const EMERALD = person('emerald', 'Emerald Princess 330', '2026-10-20T12:00:00Z');

afterEach(() => {
  vi.restoreAllMocks();
});

/** The section, ready, with a code and nothing listed unless a case says otherwise. */
function setup(props: Partial<FriendsSectionProps> = {}) {
  const user = userEvent.setup();
  const handlers = {
    onRetry: vi.fn(),
    onSend: vi.fn<FriendsSectionProps['onSend']>().mockResolvedValue({ok: true, message: 'Request sent to Steel Pirate 777.'}),
    onAccept: vi.fn<FriendsSectionProps['onAccept']>().mockResolvedValue(null),
    onRemove: vi.fn<FriendsSectionProps['onRemove']>().mockResolvedValue(null),
  };
  const all: FriendsSectionProps = {
    status: 'ready',
    code: 'ABCD2345',
    received: [],
    sent: [],
    friends: [],
    busy: false,
    ...handlers,
    ...props,
  };
  const view = render(<FriendsSection {...all} />);
  // The page's reload, as the section sees it: new lists after an action.
  const rerender = (next: Partial<FriendsSectionProps>) => view.rerender(<FriendsSection {...all} {...next} />);
  return {user, rerender, ...handlers};
}

describe('FriendsSection', () => {
  it('shows the code with its hyphen, and no lists before there is anyone in them', () => {
    setup();
    expect(screen.getByText('ABCD-2345')).toBeInTheDocument();
    expect(screen.getByText("No friends yet. Share your code, or enter a friend's.")).toBeInTheDocument();
    expect(screen.queryByRole('heading', {name: /Requests|Sent/})).toBeNull();
  });

  it('copies the code with its hyphen and says so', async () => {
    const {user} = setup();
    await user.click(screen.getByRole('button', {name: 'Copy your friend code'}));
    await expect(navigator.clipboard.readText()).resolves.toBe('ABCD-2345');
    expect(screen.getByText('Copied')).toBeInTheDocument();
  });

  it('says to select the code when the clipboard refuses', async () => {
    const {user} = setup();
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new DOMException('Denied', 'NotAllowedError'));
    await user.click(screen.getByRole('button', {name: 'Copy your friend code'}));
    expect(await screen.findByText("Couldn't copy. Select the code instead.")).toBeInTheDocument();
  });

  it('enables Send only for a whole code, and sends it as the database reads it', async () => {
    const {user, onSend} = setup();
    const field = screen.getByLabelText('Add a friend');
    const send = screen.getByRole('button', {name: 'Send request'});

    await user.type(field, 'ABC');
    expect(send).toBeDisabled();

    await user.clear(field);
    await user.type(field, 'abcd 2345');
    expect(send).toBeEnabled();

    await user.click(send);
    expect(onSend).toHaveBeenCalledWith('ABCD2345');
    expect(screen.getByRole('status')).toHaveTextContent('Request sent to Steel Pirate 777.');
    expect(field).toHaveValue('');
  });

  it('keeps a code typed while the last send was on its way', async () => {
    const {user, onSend} = setup();
    let finish: (outcome: SendOutcome) => void = () => {};
    onSend.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const field = screen.getByLabelText('Add a friend');
    await user.type(field, 'M3PZ-8RQT');
    await user.click(screen.getByRole('button', {name: 'Send request'}));
    await user.clear(field);
    await user.type(field, 'AT15-W9ZN');

    await act(async () => finish({ok: true, message: 'Request sent to Steel Pirate 777.'}));
    expect(field).toHaveValue('AT15-W9ZN');
  });

  it('shows a refusal as an alert and keeps the code that was typed', async () => {
    const {user, onSend} = setup();
    onSend.mockResolvedValue({ok: false, message: 'No one has that friend code. Check it with your friend.'});
    await user.type(screen.getByLabelText('Add a friend'), 'M3PZ-8RQT');
    await user.click(screen.getByRole('button', {name: 'Send request'}));

    expect(await screen.findByRole('alert')).toHaveTextContent('No one has that friend code. Check it with your friend.');
    expect(screen.getByLabelText('Add a friend')).toHaveValue('M3PZ-8RQT');
  });

  it('announces a second refusal with the same words as a new alert', async () => {
    const {user, onSend} = setup();
    onSend.mockResolvedValue({ok: false, message: 'No one has that friend code. Check it with your friend.'});
    await user.type(screen.getByLabelText('Add a friend'), 'M3PZ-8RQT');
    await user.click(screen.getByRole('button', {name: 'Send request'}));
    const first = await screen.findByRole('alert');

    await user.click(screen.getByRole('button', {name: 'Send request'}));
    // A screen reader speaks an alert when it appears, not when its text stays the same.
    await waitFor(() => expect(screen.getByRole('alert')).not.toBe(first));
  });

  it('lists requests, sent and friends, each under its heading', () => {
    setup({received: [RUBY], sent: [STEEL], friends: [EMERALD, AMBER]});
    expect(screen.getByRole('heading', {name: 'Requests (1)'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Sent (1)'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Your friends (2)'})).toBeInTheDocument();
    expect(screen.getByText('Waiting')).toBeInTheDocument();
    expect(screen.getAllByText(/^Friends since /)).toHaveLength(2);
  });

  it("calls each row's action with its row", async () => {
    const {user, onAccept, onRemove} = setup({received: [RUBY], sent: [STEEL]});
    await user.click(screen.getByRole('button', {name: 'Accept request from Ruby Hero 042'}));
    expect(onAccept).toHaveBeenCalledWith(RUBY);

    await user.click(screen.getByRole('button', {name: 'Decline request from Ruby Hero 042'}));
    expect(onRemove).toHaveBeenCalledWith(RUBY);

    await user.click(screen.getByRole('button', {name: 'Cancel request to Steel Pirate 777'}));
    expect(onRemove).toHaveBeenCalledWith(STEEL);
  });

  it('asks before removing a friend, keeping focus on the question', async () => {
    const {user, onRemove} = setup({friends: [AMBER]});
    await user.click(screen.getByRole('button', {name: 'Remove Amber Toy 115'}));
    expect(onRemove).not.toHaveBeenCalled();
    expect(screen.getByRole('button', {name: 'Remove friend Amber Toy 115'})).toHaveFocus();

    await user.click(screen.getByRole('button', {name: 'Cancel'}));
    expect(screen.getByRole('button', {name: 'Remove Amber Toy 115'})).toHaveFocus();

    await user.click(screen.getByRole('button', {name: 'Remove Amber Toy 115'}));
    await user.click(screen.getByRole('button', {name: 'Remove friend Amber Toy 115'}));
    expect(onRemove).toHaveBeenCalledWith(AMBER);
  });

  it('does nothing while another action runs', async () => {
    const {user, onAccept, onSend} = setup({received: [RUBY], busy: true});
    await user.click(screen.getByRole('button', {name: 'Accept request from Ruby Hero 042'}));
    await user.type(screen.getByLabelText('Add a friend'), 'M3PZ-8RQT{Enter}');
    expect(onAccept).not.toHaveBeenCalled();
    expect(onSend).not.toHaveBeenCalled();
  });

  it("shows an action's failure as an alert", async () => {
    const {user, onAccept} = setup({received: [RUBY]});
    onAccept.mockResolvedValue("That didn't go through. Try again.");
    await user.click(screen.getByRole('button', {name: 'Accept request from Ruby Hero 042'}));
    expect(await screen.findByRole('alert')).toHaveTextContent("That didn't go through. Try again.");
  });

  it('moves focus to the next request when one leaves', async () => {
    const {user, rerender} = setup({received: [RUBY, SAPPHIRE]});
    await user.click(screen.getByRole('button', {name: 'Decline request from Ruby Hero 042'}));
    rerender({received: [SAPPHIRE]});
    expect(screen.getByRole('button', {name: 'Accept request from Sapphire Dragon 204'})).toHaveFocus();
  });

  it('moves focus to Sent when the last request leaves and Sent still holds a row', async () => {
    const {user, rerender} = setup({received: [RUBY], sent: [STEEL]});
    await user.click(screen.getByRole('button', {name: 'Accept request from Ruby Hero 042'}));
    rerender({received: [], sent: [STEEL], friends: [{...RUBY, since: '2026-10-21T08:00:00Z'}]});
    expect(screen.getByRole('heading', {name: 'Sent (1)'})).toHaveFocus();
  });

  it('moves focus to Your friends when the last request leaves', async () => {
    const {user, rerender} = setup({received: [RUBY]});
    await user.click(screen.getByRole('button', {name: 'Accept request from Ruby Hero 042'}));
    rerender({received: [], friends: [{...RUBY, since: '2026-10-21T08:00:00Z'}]});
    expect(screen.getByRole('heading', {name: 'Your friends (1)'})).toHaveFocus();
  });

  it('says so while it loads', () => {
    setup({status: 'loading', code: null});
    expect(screen.getByText('Loading your friends…')).toBeInTheDocument();
    expect(screen.queryByLabelText('Add a friend')).toBeNull();
  });

  it('offers to try again after a failed load', async () => {
    const {user, onRetry} = setup({status: 'failed', code: null});
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't load your friends.");
    await user.click(screen.getByRole('button', {name: 'Try again'}));
    expect(onRetry).toHaveBeenCalled();
  });
});
