import type {Meta, StoryObj} from '@storybook/react-vite';
import {fn} from 'storybook/test';
import {DisplayNameDialog} from './DisplayNameDialog';

/**
 * Save reaches the repository, which is env-gated: with no Supabase configured it
 * returns "Supabase not configured" rather than touching the network. That makes the
 * failure row demonstrable without a fixture — edit the name and press Save.
 */
const meta: Meta<typeof DisplayNameDialog> = {
  title: 'Profile/DisplayNameDialog',
  component: DisplayNameDialog,
  tags: ['autodocs'],
  args: {
    isOpen: true,
    onClose: fn(),
    onSaved: fn(),
    userId: '00000000-0000-4000-8000-000000000001',
    current: 'Emerald Princess 330',
  },
};
export default meta;
type Story = StoryObj<typeof meta>;

/** A fresh account: the auto-assigned handle, written like a name. */
export const AutoAssignedName: Story = {};

/** After renaming. Save stays disabled until the name actually changes. */
export const RenamedByTheUser: Story = {
  args: {current: 'Doberjohn'},
};

/** The 60-character cap the column enforces; the field stops accepting input here. */
export const LongestAllowedName: Story = {
  // Exactly DISPLAY_NAME_MAX. The previous value was 61, one past the limit it exists
  // to illustrate, so the story showed a name the dialog would refuse to save.
  args: {current: 'A Very Long Deck Building Name That Reaches Sixty Characters'},
};
