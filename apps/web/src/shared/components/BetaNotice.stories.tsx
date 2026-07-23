import type {Meta, StoryObj} from '@storybook/react-vite';
import {BetaNotice} from './BetaNotice';

const meta: Meta<typeof BetaNotice> = {
  title: 'Shared/BetaNotice',
  component: BetaNotice,
  parameters: {layout: 'fullscreen'},
  decorators: [
    (Story) => (
      <div style={{position: 'relative', minHeight: '100vh'}}>
        <Story />
      </div>
    ),
  ],
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
