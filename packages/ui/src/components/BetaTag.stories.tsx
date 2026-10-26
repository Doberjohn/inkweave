import type {Meta, StoryObj} from '@storybook/react-vite';
import {BetaTag} from './BetaTag';

const meta: Meta<typeof BetaTag> = {
  title: 'Shared/BetaTag',
  component: BetaTag,
  parameters: {layout: 'centered'},
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
