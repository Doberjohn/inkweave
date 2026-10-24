import type {Meta, StoryObj} from '@storybook/react-vite';
import {fn} from 'storybook/test';
import {MechanicsBottomSheet} from './MechanicsBottomSheet';
import type {RoleTile} from './RoleTileRow';

const toyTiles: RoleTile[] = [
  {role: 'banish-trigger', label: 'Banish Trigger', description: 'Trigger an effect when a Toy character is banished', count: 5},
  {role: 'draw', label: 'Card Draw', description: 'Draw extra cards', count: 4},
  {role: 'self-discount', label: 'Self Discount', description: 'Pay less to play a character under some condition', count: 4},
  {role: 'search', label: 'Search', description: 'Search your deck for Toy characters', count: 2},
  {role: 'cost-reduction', label: 'Cost Reduction', description: 'Reduce the cost of other cards you play', count: 1},
  {role: 'targeted', label: 'Targeted Discard', description: 'Choose which card opponents discard', count: 1},
  {role: 'burn', label: 'Lore Burn', description: 'Make your opponents lose lore', count: 1},
  {role: 'steal', label: 'Lore Steal', description: 'Steal lore from your opponents to gain your own', count: 1},
];

const meta: Meta<typeof MechanicsBottomSheet> = {
  title: 'Synergies/MechanicsBottomSheet',
  component: MechanicsBottomSheet,
  parameters: {layout: 'fullscreen'},
  globals: {viewport: {value: 'mobile1'}},
  tags: ['autodocs'],
  args: {
    isOpen: true,
    onClose: fn(),
    onToggle: fn(),
    onClearAll: fn(),
    onRetry: fn(),
    tiles: toyTiles,
    status: 'loaded',
    activeRoles: new Set<string>(),
  },
};
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithActiveRoles: Story = {
  args: {
    activeRoles: new Set(['banish-trigger', 'self-discount']),
  },
};

export const SinglePopulatedMechanic: Story = {
  args: {
    tiles: [toyTiles[0]],
  },
};

export const Closed: Story = {
  args: {isOpen: false},
};

/** The tiles failed to load while the cards loaded (#930): the sheet says so, with a Try again. */
export const Failed: Story = {
  args: {status: 'failed', tiles: []},
};

/** After Try again, until the tiles arrive: placeholders where they will be (#930). */
export const LoadingAgain: Story = {
  args: {status: 'loading', tiles: []},
};
