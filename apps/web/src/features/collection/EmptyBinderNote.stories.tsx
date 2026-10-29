import type {Meta, StoryObj} from '@storybook/react-vite';
import {fn} from 'storybook/test';
import {EmptyBinderNote} from './EmptyBinderNote';
import {COLORS} from '../../shared/constants';

/**
 * The note on an empty collection's inside front cover. The binder's own stories show it in
 * place (`CollectionBinderSection`'s EmptyCollection); these frame it at a spread's page size.
 */
const meta: Meta<typeof EmptyBinderNote> = {
  title: 'Collection/EmptyBinderNote',
  component: EmptyBinderNote,
  decorators: [
    (Story) => (
      <div style={{height: 520, maxWidth: 420, background: COLORS.background}}>
        <Story />
      </div>
    ),
  ],
  tags: ['autodocs'],
  args: {onImport: fn()},
};

export default meta;
type Story = StoryObj<typeof meta>;

/** On a spread's cover, in its middle. With a mouse it says to point at a card. */
export const Spread: Story = {};

/** On a phone: at the cover's top, the width of the page, and it says to tap a card. */
export const Phone: Story = {globals: {viewport: {value: 'mobile1'}}};
