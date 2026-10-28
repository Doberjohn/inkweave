import type {Meta, StoryObj} from '@storybook/react-vite';
import {MemoryRouter} from 'react-router-dom';
import {fn} from 'storybook/test';
import {createCard} from '../../shared/test-utils';
import type {SharingFriend} from './friendsCopies';
import type {FriendHas} from './friendsHave';
import {FriendsWhoHaveIt} from './FriendsWhoHaveIt';

/**
 * Friends who have it (#1055): the card window's count opens it, over the window. The card, what
 * you hold of it, and each sharing friend holding a copy in a finish you lack, most copies first;
 * a row opens that friend's binder at the card.
 */

const PONGO = createCard({
  id: '1938',
  name: 'Pongo',
  version: 'Determined Father',
  fullName: 'Pongo - Determined Father',
  setCode: '9',
  setNumber: 2,
  rarity: 'Super Rare',
  imageUrl: '/card-images/1938.38360237d5667c5b.avif',
});

const friend = (name: string): SharingFriend => ({
  id: name,
  name,
  handle: name.toLowerCase().replaceAll(' ', '_'),
  entries: {},
});
const row = (name: string, normal: number, foil: number): FriendHas => ({friend: friend(name), normal, foil});

const TWO = [row('Emerald Fairy 913', 3, 1), row('Ruby Hero 042', 2, 0)];

const NAMES = ['Amber', 'Amethyst', 'Emerald', 'Ruby', 'Sapphire', 'Steel', 'Mickey'];
/** Fourteen friends: past the ten and a half rows that show before the list scrolls. */
const FOURTEEN = Array.from({length: 14}, (_, i) => row(`${NAMES[i % NAMES.length]} Player ${100 + i}`, 4 - (i % 5), i % 3 === 0 ? 1 : 0));

const meta: Meta<typeof FriendsWhoHaveIt> = {
  title: 'Collection/FriendsWhoHaveIt',
  component: FriendsWhoHaveIt,
  decorators: [
    (Story) => (
      <MemoryRouter>
        <Story />
      </MemoryRouter>
    ),
  ],
  tags: ['autodocs'],
  args: {
    isOpen: true,
    onClose: fn(),
    onFollow: fn(),
    card: PONGO,
    finishes: ['normal', 'foil'],
    held: {normal: 0, foil: 0},
    have: {lacked: ['normal', 'foil'], friends: TWO},
    notSharing: 1,
    isMobile: false,
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

/** A card you lack: both finishes counted, and the friends who don't share noted at the foot. */
export const Desktop: Story = {};

/** Under Master set, a card you hold in normal: only the foil counts, and only friends with one. */
export const FoilOnly: Story = {
  args: {
    held: {normal: 1, foil: 0},
    have: {lacked: ['foil'], friends: [row('Ruby Hero 042', 0, 1), row('Amethyst Witch 7', 0, 1)]},
    notSharing: 0,
  },
};

export const OneFriend: Story = {args: {have: {lacked: ['normal', 'foil'], friends: [row('Ruby Hero 042', 1, 0)]}, notSharing: 0}};

/** More friends than the list shows: it scrolls under the title and the card, which stay. */
export const ManyFriends: Story = {args: {have: {lacked: ['normal', 'foil'], friends: FOURTEEN}, notSharing: 3}};

/** A friend with no public name: shown as Inkweave player, with no binder to link to. */
export const FriendWithNoName: Story = {
  args: {
    have: {lacked: ['normal', 'foil'], friends: [...TWO, {friend: {...friend('Inkweave player'), handle: null}, normal: 1, foil: 0}]},
  },
};

/** On a phone: a sheet over the card window. */
export const Mobile: Story = {args: {isMobile: true}, globals: {viewport: {value: 'mobile1'}}};

export const MobileManyFriends: Story = {
  args: {isMobile: true, have: {lacked: ['normal', 'foil'], friends: FOURTEEN}, notSharing: 3},
  globals: {viewport: {value: 'mobile1'}},
};
