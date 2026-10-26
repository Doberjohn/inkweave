import type {Meta, StoryObj} from '@storybook/react-vite';
import {InkwellIcon} from './InkwellIcon';

const meta: Meta<typeof InkwellIcon> = {
  title: 'Components/InkwellIcon',
  component: InkwellIcon,
  parameters: {layout: 'centered'},
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof meta>;

export const Inkable: Story = {
  args: {value: 'inkable', size: 32, decorative: false},
};

export const Uninkable: Story = {
  args: {value: 'uninkable', size: 32, decorative: false},
};
