import type {Meta, StoryObj} from '@storybook/react-vite';
import {MemoryRouter} from 'react-router-dom';
import {fn, userEvent, within} from 'storybook/test';
import {CAP_LABEL, SPACING, SURFACE_CARD} from '../../shared/constants';
import {FriendsSection} from './FriendsSection';
import type {FriendRow} from './useFriends';

/**
 * The Friends section on /account (#852), framed as the page's `Section` frames it, at the
 * page's content width. Every action resolves at once and the lists stay as they are: on the
 * page, the reload that follows each action is what changes them.
 */

const person = (id: string, name: string, since: string | null = null): FriendRow => ({
  id,
  name,
  handle: name.toLowerCase().replaceAll(' ', '_'),
  since,
  pair: {requesterId: id, addresseeId: 'me'},
});
const RUBY = person('ruby', 'Ruby Hero 042');
// A request the player sent, so the pair runs from them to Steel.
const STEEL = {...person('steel', 'Steel Pirate 777'), pair: {requesterId: 'me', addresseeId: 'steel'}};
const EMERALD = person('emerald', 'Emerald Princess 330', '2026-10-20T12:00:00Z');
const AMBER = person('amber', 'Amber Toy 115', '2026-10-19T09:00:00Z');
const AMETHYST = person('amethyst', 'Amethyst Sorcerer 518', '2026-10-02T18:30:00Z');

const meta: Meta<typeof FriendsSection> = {
  title: 'Friends/FriendsSection',
  component: FriendsSection,
  decorators: [
    (Story) => (
      // View binder is a link into Browse.
      <MemoryRouter>
        <section style={{...SURFACE_CARD, padding: SPACING.xl, maxWidth: 656}}>
          <h2 style={{...CAP_LABEL, margin: `0 0 ${SPACING.md}px`}}>Friends</h2>
          <Story />
        </section>
      </MemoryRouter>
    ),
  ],
  tags: ['autodocs'],
  args: {
    status: 'ready',
    code: 'ABCD2345',
    received: [],
    sent: [],
    friends: [],
    busy: false,
    onRetry: fn(),
    onSend: fn(async () => ({ok: true, message: 'Request sent to Ruby Hero 042.'})),
    onAccept: fn(async () => null),
    onRemove: fn(async () => null),
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

/** A new player: their code to share, and no one yet. */
export const Empty: Story = {};

export const RequestsAndSent: Story = {
  args: {received: [RUBY], sent: [STEEL]},
};

/** Newest friend first. */
export const Friends: Story = {
  args: {friends: [EMERALD, AMBER, AMETHYST]},
};

/**
 * With collections on (#1045): View binder beside each friend who shares their collection,
 * and Not sharing beside the rest.
 */
export const Sharing: Story = {
  args: {friends: [EMERALD, AMBER, AMETHYST], sharing: new Set(['emerald', 'amethyst'])},
};

/** An action running: every button looks off and does nothing until the page's reload lands. */
export const Busy: Story = {
  args: {received: [RUBY], sent: [STEEL], friends: [EMERALD], busy: true},
};

/**
 * While the friendships load (#914): the boxes of a section with no one in it, which every
 * player's has, so the sections under it hold still when it loads.
 */
export const Loading: Story = {
  args: {status: 'loading', code: null},
};

export const FailedLoad: Story = {
  args: {status: 'failed', code: null},
};

/** A code no one has: the refusal shows under the field, and the code stays there to fix. */
export const Refusal: Story = {
  args: {
    onSend: fn(async () => ({ok: false, message: 'No one has that friend code. Check it with your friend.'})),
  },
  play: async ({canvasElement}) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByLabelText('Add a friend'), 'M3PZ-8RQT');
    await userEvent.click(canvas.getByRole('button', {name: 'Send request'}));
  },
};
