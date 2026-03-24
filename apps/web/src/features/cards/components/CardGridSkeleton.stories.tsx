import type {Meta, StoryObj} from '@storybook/react-vite';
import {CardGridSkeleton} from './CardGridSkeleton';

const meta: Meta<typeof CardGridSkeleton> = {
  title: 'Cards/CardGridSkeleton',
  component: CardGridSkeleton,
  parameters: {
    layout: 'fullscreen',
    backgrounds: {default: 'dark'},
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
type Story = StoryObj<typeof CardGridSkeleton>;

export const Default: Story = {};

export const ForcedColumns: Story = {
  args: {
    columns: 4,
    rows: 2,
  },
};
