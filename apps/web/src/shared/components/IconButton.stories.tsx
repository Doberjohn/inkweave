import type {Meta, StoryObj} from '@storybook/react-vite';
import {IconButton} from './IconButton';
import {SearchIcon} from './SearchIcon';

const meta: Meta<typeof IconButton> = {
  title: 'Shared/IconButton',
  component: IconButton,
  parameters: {layout: 'centered'},
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof meta>;

// The close-× consolidation: five hand-rolled recipes become this one.
export const Close: Story = {args: {'aria-label': 'Close', children: '×'}};

export const WithSvgIcon: Story = {args: {'aria-label': 'Search', children: <SearchIcon size={20} />}};

// Compact variant for dense chrome (modal corners); hit target stays generous.
export const Compact: Story = {args: {'aria-label': 'Close', size: 36, children: '×'}};

export const Disabled: Story = {args: {'aria-label': 'Close', disabled: true, children: '×'}};
