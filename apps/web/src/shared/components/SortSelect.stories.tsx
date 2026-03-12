import {useState} from 'react';
import type {Meta, StoryObj} from '@storybook/react-vite';
import {SortSelect} from './SortSelect';

const SORT_OPTIONS = [
  {value: 'name-asc', label: 'Name A–Z'},
  {value: 'name-desc', label: 'Name Z–A'},
  {value: 'cost-asc', label: 'Cost ↑'},
  {value: 'cost-desc', label: 'Cost ↓'},
];

const meta: Meta<typeof SortSelect> = {
  title: 'Components/SortSelect',
  component: SortSelect,
  parameters: {layout: 'centered'},
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    options: SORT_OPTIONS,
    value: 'name-asc',
    onChange: () => {},
    ariaLabel: 'Sort cards',
  },
};

export const Interactive: Story = {
  render: () => {
    const [value, setValue] = useState('name-asc');
    return (
      <SortSelect options={SORT_OPTIONS} value={value} onChange={setValue} ariaLabel="Sort cards" />
    );
  },
};
