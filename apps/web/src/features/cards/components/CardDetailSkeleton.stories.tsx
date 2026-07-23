import type {Meta, StoryObj} from '@storybook/react-vite';
import {CardDetailSkeleton} from './CardDetailSkeleton';

const meta: Meta<typeof CardDetailSkeleton> = {
  title: 'Cards/CardDetailSkeleton',
  component: CardDetailSkeleton,
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (Story) => (
      <div style={{background: '#0d0d14', minHeight: '100vh'}}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof CardDetailSkeleton>;

export const Default: Story = {};

export const FixedSidebarWidth: Story = {
  args: {
    width: 330,
  },
};

export const SidePairPreview: Story = {
  render: (args) => (
    <div style={{display: 'flex', gap: 16, padding: 16}}>
      <CardDetailSkeleton {...args} width={330} />
      <CardDetailSkeleton {...args} width={330} />
    </div>
  ),
};

export const CompactMobile: Story = {
  args: {
    imageWidth: 240,
    textLines: 3,
  },
};
