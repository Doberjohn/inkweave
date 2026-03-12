import {useState} from 'react';
import type {Meta, StoryObj} from '@storybook/react-vite';
import type {Ink} from 'inkweave-synergy-engine';
import {InkFilterGroup} from './InkFilterGroup';

const meta: Meta<typeof InkFilterGroup> = {
  title: 'Components/InkFilterGroup',
  component: InkFilterGroup,
  parameters: {layout: 'centered'},
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof meta>;

export const NoneSelected: Story = {
  args: {
    inkFilters: [],
    onToggleInk: () => {},
  },
};

export const SomeSelected: Story = {
  args: {
    inkFilters: ['Amber', 'Ruby'] as Ink[],
    onToggleInk: () => {},
  },
};

export const SmallSize: Story = {
  args: {
    inkFilters: ['Sapphire'] as Ink[],
    onToggleInk: () => {},
    size: 'sm',
    iconSize: 20,
  },
};

export const Interactive: Story = {
  render: () => {
    const [filters, setFilters] = useState<Ink[]>([]);
    const toggle = (ink: Ink) =>
      setFilters((prev) => (prev.includes(ink) ? prev.filter((i) => i !== ink) : [...prev, ink]));
    return <InkFilterGroup inkFilters={filters} onToggleInk={toggle} />;
  },
};
