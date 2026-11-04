import type {Meta, StoryObj} from '@storybook/react-vite';
import {fn, userEvent, within} from 'storybook/test';
import {RenameBinderDialog} from './RenameBinderDialog';
import {STORY_AMBER} from './binderStoryData';

/**
 * Rename, from a binder's ⋯: its name filled in and selected, and Save once it is a name the
 * table takes and another than the binder's. Saves reach the server, so these stories never
 * press Save; its unit tests hold the saving and failure states. A dialog on a computer, a sheet
 * on a phone.
 */
const meta: Meta<typeof RenameBinderDialog> = {
  title: 'Collection/Binders/RenameBinderDialog',
  component: RenameBinderDialog,
  tags: ['autodocs'],
  args: {
    isOpen: true,
    binder: STORY_AMBER,
    readerId: 'story-reader',
    isMobile: false,
    onSaved: fn(),
    onClose: fn(),
    onGone: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

/** As it opens: the name selected, Save off. */
export const Default: Story = {};

/** A new name typed: Save on. */
export const Renamed: Story = {
  play: async () => {
    await userEvent.type(within(document.body).getByRole('textbox', {name: 'Name'}), 'Amber chase');
  },
};

/** A phone's sheet. */
export const Phone: Story = {args: {isMobile: true}, globals: {viewport: {value: 'mobile1'}}};
