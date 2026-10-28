import type {Meta, StoryObj} from '@storybook/react-vite';
import {SPACING} from '../../shared/constants';
import {FriendChip} from './FriendChip';

/**
 * A friend's initials in the ink their handle starts with (#1045), as the Friends list and a
 * friend's binder's banner draw them; the neutral surface for a handle with no ink.
 */
const meta: Meta<typeof FriendChip> = {
  title: 'Friends/FriendChip',
  component: FriendChip,
  tags: ['autodocs'],
  args: {name: 'Ruby Hero 042', handle: 'ruby_hero_042', size: 'md'},
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Ruby: Story = {};

/** The banner's size. */
export const Large: Story = {args: {size: 'lg'}};

/** A handle with no ink in it. */
export const NoInk: Story = {args: {name: 'Mickey Fan', handle: 'mickey_fan'}};

const EVERY_INK = [
  ['Amber Toy 115', 'amber_toy_115'],
  ['Amethyst Sorcerer 518', 'amethyst_sorcerer_518'],
  ['Emerald Princess 330', 'emerald_princess_330'],
  ['Ruby Hero 042', 'ruby_hero_042'],
  ['Sapphire Dragon 204', 'sapphire_dragon_204'],
  ['Steel Pirate 777', 'steel_pirate_777'],
  ['Mickey Fan', 'mickey_fan'],
] as const;

/** Each ink, then no ink, side by side. */
export const EveryInk: Story = {
  render: (args) => (
    <div style={{display: 'flex', gap: SPACING.sm}}>
      {EVERY_INK.map(([name, handle]) => (
        <FriendChip key={handle} {...args} name={name} handle={handle} />
      ))}
    </div>
  ),
};
