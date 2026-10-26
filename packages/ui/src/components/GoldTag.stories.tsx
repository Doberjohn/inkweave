import type {Meta, StoryObj} from '@storybook/react-vite';
import {GoldTag} from './GoldTag';

const meta: Meta<typeof GoldTag> = {
  title: 'Shared/GoldTag',
  component: GoldTag,
  parameters: {layout: 'centered'},
  tags: ['autodocs'],
  args: {children: 'Highlight'},
};
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
