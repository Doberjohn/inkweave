import type {Meta, StoryObj} from '@storybook/react-vite';
import {fn} from 'storybook/test';
import {FiltersButton} from './FiltersButton';

const meta: Meta<typeof FiltersButton> = {
  title: 'Components/FiltersButton',
  component: FiltersButton,
  parameters: {layout: 'centered'},
  tags: ['autodocs'],
  args: {onClick: fn()},
};
export default meta;
type Story = StoryObj<typeof meta>;

export const NoActiveFilters: Story = {
  args: {activeCount: 0},
};

export const WithActiveFilters: Story = {
  args: {activeCount: 3},
};

export const Mobile: Story = {
  args: {activeCount: 2, isMobile: true},
};
