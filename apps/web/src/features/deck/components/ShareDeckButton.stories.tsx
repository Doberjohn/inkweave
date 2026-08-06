import type {Meta, StoryObj} from '@storybook/react-vite';
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

/** The whole interaction: press, copy, done. Public is the only state that copies. */
export const PublicDeck: Story = {};

/**
 * A private deck. The button is inert and carries its reason, because the link
 * resolves to nothing for everyone but the owner (owner ruling 2026-08-05).
 *
 * Only the owner ever sees this: RLS returns no row for a private deck, so any
 * deck a stranger is looking at is public by definition.
 */
export const PrivateDeck: Story = {
  args: {deck: {...DECK, isPublic: false}},
};

/**
 * A deck with `isPublic` absent rather than false, which is how an older row or a
 * partial payload arrives. Treated as private: the safe reading, since guessing
 * public would hand out a link that may not resolve.
 */
export const VisibilityUnset: Story = {
  args: {deck: {...DECK, isPublic: undefined}},
};
