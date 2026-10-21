import type {Meta, StoryObj} from '@storybook/react-vite';
import {fn} from 'storybook/test';
import {SynergyMoreTile} from './SynergyMoreTile';

/** A synergy group's "+N more" tile, at a synergy card's width. Point at it for the gold glow. */
const meta: Meta<typeof SynergyMoreTile> = {
  title: 'Features/SynergyMoreTile',
  component: SynergyMoreTile,
  tags: ['autodocs'],
  args: {count: 12, onClick: fn()},
  decorators: [
    (Story) => (
      // Room round the tile for its glow.
      <div style={{width: 160, padding: 32}}>
        <Story />
      </div>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** The card window's narrow grids. */
export const Compact: Story = {
  args: {compact: true},
  decorators: [
    (Story) => (
      <div style={{width: 90}}>
        <Story />
      </div>
    ),
  ],
};

export const Mobile: Story = {
  args: {isMobile: true},
};
