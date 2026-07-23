import type {Meta, StoryObj} from '@storybook/react-vite';
import {CardGridSkeleton} from './CardGridSkeleton';

const meta: Meta<typeof CardGridSkeleton> = {
  title: 'Cards/CardGridSkeleton',
  component: CardGridSkeleton,
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
type Story = StoryObj<typeof CardGridSkeleton>;

export const Default: Story = {};

export const ForcedColumns: Story = {
  args: {
    columns: 4,
    rows: 2,
  },
};

export const WideTiles: Story = {
  args: {
    columns: 3,
    rows: 2,
    aspectRatio: 1.4,
    ariaLabel: 'Loading playstyles',
  },
};

export const SingleColumn: Story = {
  args: {
    columns: 1,
    rows: 4,
  },
};
