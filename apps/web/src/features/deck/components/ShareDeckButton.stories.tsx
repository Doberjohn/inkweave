import type {Meta, StoryObj} from '@storybook/react-vite';
import {fn} from 'storybook/test';
import {ShareDeckButton} from './ShareDeckButton';
import type {Deck} from '../types';

const DECK: Deck = {
  id: 'demo-deck-1',
  name: 'Amber Steel Aggro',
  cards: [{cardId: '901', quantity: 4}],
  inks: ['Amber', 'Steel'],
  isPublic: true,
  ownerId: 'owner-1',
  createdAt: 0,
  updatedAt: 0,
  schemaVersion: 1,
};

const meta: Meta<typeof ShareDeckButton> = {
  title: 'Deck/ShareDeckButton',
  component: ShareDeckButton,
  tags: ['autodocs'],
  args: {deck: DECK},
};
export default meta;
type Story = StoryObj<typeof meta>;

/** The whole interaction for a deck that is already public: press, copy, done. */
export const PublicDeck: Story = {};

/**
 * The owner of a PRIVATE deck. Pressing the button does not copy: it states what
 * publishing would mean and waits, because sharing a link and publishing to the
 * community feed are different intentions.
 */
export const PrivateDeckOwner: Story = {
  args: {deck: {...DECK, isPublic: false}, onPublish: fn(() => Promise.resolve(true))},
};

/** The publish write failed, so nothing was copied and the deck is still private. */
export const PublishFails: Story = {
  args: {deck: {...DECK, isPublic: false}, onPublish: fn(() => Promise.resolve(false))},
};

/**
 * A visitor on someone else's public deck: no `onPublish`, so there is nothing
 * here but the copy. A visitor never meets a private deck, since RLS returns no
 * row for one.
 */
export const Visitor: Story = {args: {onPublish: undefined}};
