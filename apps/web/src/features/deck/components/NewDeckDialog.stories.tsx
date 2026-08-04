import type {Meta, StoryObj} from '@storybook/react-vite';
import {fn} from 'storybook/test';
import {NewDeckDialog} from './NewDeckDialog';

const meta: Meta<typeof NewDeckDialog> = {
  title: 'Deck/NewDeckDialog',
  component: NewDeckDialog,
  tags: ['autodocs'],
  args: {
    isOpen: true,
    onClose: fn(),
    onConfirm: fn(),
    onSignIn: fn(),
    showReplaceWarning: false,
    canPublish: true,
  },
};
export default meta;
type Story = StoryObj<typeof meta>;

/** Signed in: both visibility options live, and there is a cloud deck to fall back on. */
export const Default: Story = {};

/** A guest with work in progress — starting over destroys it, so the offer to sign in rides along. */
export const WithReplaceWarning: Story = {args: {showReplaceWarning: true, canPublish: false}};

/** Public stays visible while signed out so the missing capability explains itself. */
export const GuestCannotPublish: Story = {args: {canPublish: false}};

export const Closed: Story = {args: {isOpen: false}};
