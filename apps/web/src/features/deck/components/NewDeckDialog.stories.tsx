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
    canKeepBoth: false,
    canPublish: true,
  },
};
export default meta;
type Story = StoryObj<typeof meta>;

/** Signed in with nothing to lose: the visibility choice is the whole dialog. */
export const Default: Story = {};

/**
 * A guest with work in progress. No visibility choice, since they cannot save and so
 * cannot publish, and the warning carries the offer that would have prevented the
 * loss. This is the ONLY shape a guest ever sees: with nothing to lose there is
 * nothing to say, so DecksPage skips the dialog and opens the builder directly.
 */
export const GuestAboutToLoseWork: Story = {
  args: {showReplaceWarning: true, canKeepBoth: true, canPublish: false},
};

/** Signed in with unsaved work: warned, but not offered an account they already have. */
export const SignedInAboutToLoseWork: Story = {
  args: {showReplaceWarning: true, canKeepBoth: false, canPublish: true},
};

export const Closed: Story = {args: {isOpen: false}};
