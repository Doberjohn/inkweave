import {useState} from 'react';
import type {Meta, StoryObj} from '@storybook/react-vite';
import {CostFilterGroup} from './CostFilterGroup';

const meta: Meta<typeof CostFilterGroup> = {
  title: 'Components/CostFilterGroup',
  component: CostFilterGroup,
  parameters: {layout: 'centered'},
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof meta>;

export const NoneSelected: Story = {
  args: {costFilters: [], onToggleCost: () => {}},
};

export const SomeSelected: Story = {
  args: {costFilters: [2, 5], onToggleCost: () => {}},
};

export const Interactive: Story = {
  render: () => {
    const [costs, setCosts] = useState<number[]>([]);
    const toggle = (c: number) =>
      setCosts((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
    return <CostFilterGroup costFilters={costs} onToggleCost={toggle} />;
  },
};
