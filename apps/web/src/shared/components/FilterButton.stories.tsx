import type {Meta, StoryObj} from '@storybook/react-vite';
import {fn} from 'storybook/test';
import {FilterButton} from './FilterButton';

const meta: Meta<typeof FilterButton> = {
  title: 'Components/FilterButton',
  component: FilterButton,
  parameters: {layout: 'centered'},
  tags: ['autodocs'],
  args: {onClick: fn()},
};
export default meta;
type Story = StoryObj<typeof meta>;

export const Inactive: Story = {
  args: {active: false, children: 'Character'},
};

export const Active: Story = {
  args: {active: true, children: 'Character'},
};

export const SmallSize: Story = {
  args: {active: false, children: 'Cost 3', size: 'sm'},
};

export const MediumSize: Story = {
  args: {active: true, children: 'Cost 3', size: 'md'},
};

export const CustomColors: Story = {
  args: {
    active: true,
    children: 'Emerald',
    activeColor: '#10b981',
    activeBgColor: 'rgba(16, 185, 129, 0.2)',
  },
};

export const AllStates: Story = {
  render: () => (
    <div style={{display: 'flex', gap: 8, flexWrap: 'wrap'}}>
      <FilterButton active={false} onClick={fn()}>
        Inactive SM
      </FilterButton>
      <FilterButton active={true} onClick={fn()}>
        Active SM
      </FilterButton>
      <FilterButton active={false} onClick={fn()} size="md">
        Inactive MD
      </FilterButton>
      <FilterButton active={true} onClick={fn()} size="md">
        Active MD
      </FilterButton>
    </div>
  ),
};
