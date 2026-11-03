import type {Meta, StoryObj} from '@storybook/react-vite';
import {fn} from 'storybook/test';
import {UnknownBinder} from './UnknownBinder';

/**
 * In the binder's place when the address names a binder that isn't on your shelf:
 * someone else's link, or a binder you deleted, said the same either way.
 */
const meta: Meta<typeof UnknownBinder> = {
  title: 'Collection/Binders/UnknownBinder',
  component: UnknownBinder,
  tags: ['autodocs'],
  args: {onOpenMine: fn()},
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
