import type {Meta, StoryObj} from '@storybook/react-vite';
import {fn} from 'storybook/test';
import {DeleteBinderDialog} from './DeleteBinderDialog';

/**
 * The confirm before a binder is deleted (#1074): its name, what goes and what stays, then
 * Delete binder or Keep it. A dialog on a computer, a sheet on a phone.
 */
const meta: Meta<typeof DeleteBinderDialog> = {
  title: 'Collection/Binders/DeleteBinderDialog',
  component: DeleteBinderDialog,
  tags: ['autodocs'],
  args: {isOpen: true, name: 'Amber', isMobile: false, deleting: false, failed: false, onConfirm: fn(), onClose: fn()},
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** While the delete is on its way: both buttons wait. */
export const Deleting: Story = {args: {deleting: true}};

/** The delete failed: the line, and Delete binder offered again. */
export const Failed: Story = {args: {failed: true}};

/** A thirty-letter name in the title. */
export const LongName: Story = {args: {name: 'Shimmering Sapphire Collection'}};

/** A phone's sheet. */
export const Phone: Story = {args: {isMobile: true}, globals: {viewport: {value: 'mobile1'}}};
