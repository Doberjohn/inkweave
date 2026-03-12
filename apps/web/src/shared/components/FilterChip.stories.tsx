import type {Meta, StoryObj} from '@storybook/react-vite';
import {fn} from 'storybook/test';
import {FilterChip} from './FilterChip';

const meta: Meta<typeof FilterChip> = {
  title: 'Components/FilterChip',
  component: FilterChip,
  parameters: {layout: 'centered'},
  tags: ['autodocs'],
  args: {onDismiss: fn()},
};
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {label: 'Amber'},
};

export const Mobile: Story = {
  args: {label: 'Amber', isMobile: true},
};

export const MultipleChips: Story = {
  render: () => (
    <div style={{display: 'flex', gap: 8, flexWrap: 'wrap'}}>
      <FilterChip label="Amber" onDismiss={fn()} />
      <FilterChip label="Character" onDismiss={fn()} />
      <FilterChip label="Cost 3" onDismiss={fn()} />
      <FilterChip label="Floodborn" onDismiss={fn()} />
    </div>
  ),
};
