import type {Meta, StoryObj} from '@storybook/react-vite';
import {COLORS} from '../../../shared/constants';
import {CardGridSkeleton} from './CardGridSkeleton';

const meta: Meta<typeof CardGridSkeleton> = {
  title: 'Cards/CardGridSkeleton',
  component: CardGridSkeleton,
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (Story) => (
      <div style={{background: COLORS.background, minHeight: '100vh'}}>
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

/**
 * A phone (#914): the loaded grid's 140 px column minimum gives two columns, where the desktop
 * minimum left one wide tile, in the page's 16 px gutter.
 */
export const Phone: Story = {
  args: {
    padding: '0 16px',
  },
  globals: {viewport: {value: 'mobile1'}},
};
