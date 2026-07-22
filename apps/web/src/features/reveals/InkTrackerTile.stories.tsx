import type {Meta, StoryObj} from '@storybook/react-vite';
import {InkTrackerTile} from './InkTrackerTile';

const meta: Meta<typeof InkTrackerTile> = {
  title: 'Features/Reveals/InkTrackerTile',
  component: InkTrackerTile,
  parameters: {layout: 'centered'},
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof meta>;

export const Selected: Story = {
  args: {ink: 'Amethyst', count: 16, selected: true, onSelect: () => {}},
};

export const Unselected: Story = {
  args: {ink: 'Amber', count: 20, selected: false, onSelect: () => {}},
};

export const Complete: Story = {
  args: {ink: 'Emerald', count: 34, selected: false, onSelect: () => {}},
};

export const Mobile: Story = {
  args: {ink: 'Ruby', count: 15, selected: true, compact: true, onSelect: () => {}},
};
