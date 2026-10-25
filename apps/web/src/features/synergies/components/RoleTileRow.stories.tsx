import {useState} from 'react';
import type {Meta, StoryObj} from '@storybook/react-vite';
import {fn} from 'storybook/test';
import {COLORS} from '../../../shared/constants';
import {RoleTileRow, RoleTiles, type RoleTile} from './RoleTileRow';

const locationTiles: RoleTile[] = [
  {role: 'location', label: 'Locations', description: 'Location cards', count: 54},
  {role: 'boost', label: 'Boost', description: 'Put cards under locations to boost their abilities', count: 14},
  {role: 'in-play-check', label: 'While in Play', description: 'Get benefits when you have locations in play', count: 8},
  {role: 'at-payoff', label: 'At Location', description: 'Get benefits when characters are at a location', count: 8},
  {role: 'search', label: 'Search', description: 'Search your deck or discard for locations', count: 7},
  {role: 'buff', label: 'Buff', description: 'Give locations stat boosts and protection', count: 6},
  {role: 'move', label: 'Move', description: 'Move characters to locations', count: 6},
  {role: 'location-ramp', label: 'Location Ramp', description: 'Reduce the cost of playing or moving to locations', count: 5},
  {role: 'play-trigger', label: 'Trigger', description: 'Trigger effects when you play or move to a location', count: 4},
];

const meta: Meta<typeof RoleTileRow> = {
  title: 'Features/RoleTileRow',
  component: RoleTileRow,
  parameters: {layout: 'fullscreen'},
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{padding: 24, background: COLORS.background, minHeight: 240}}>
        <Story />
      </div>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof RoleTileRow>;

/** Wraps RoleTileRow with local active-role state so stories show real toggle behavior. */
function InteractiveTileRow({
  tiles,
  showDescriptions,
}: {
  tiles: RoleTile[];
  showDescriptions?: boolean;
}) {
  const [activeRoles, setActiveRoles] = useState<Set<string>>(() => new Set());
  const toggle = (role: string) => {
    setActiveRoles((prev) => {
      const next = new Set(prev);
      if (next.has(role)) next.delete(role);
      else next.add(role);
      return next;
    });
  };
  return (
    <RoleTileRow
      tiles={tiles}
      activeRoles={activeRoles}
      onToggle={toggle}
      showDescriptions={showDescriptions}
    />
  );
}

export const Default: Story = {
  render: () => <InteractiveTileRow tiles={locationTiles} />,
};

/**
 * The compact tiles a playstyle page shows on desktop (`showDescriptions={false}`): each
 * description waits in a tooltip under its tile, on hover or focus.
 */
export const Compact: Story = {
  render: () => <InteractiveTileRow tiles={locationTiles} showDescriptions={false} />,
};

export const WithActiveTiles: Story = {
  render: () => {
    const activeRoles = new Set(['boost', 'search']);
    return (
      <RoleTileRow tiles={locationTiles} activeRoles={activeRoles} onToggle={() => {}} />
    );
  },
};

/** ≤8 mechanics: every tile shows in a static row — no show-more, no scroll. */
export const FewMechanics: Story = {
  render: () => <InteractiveTileRow tiles={locationTiles.slice(0, 5)} />,
};

/**
 * >8 mechanics: the row collapses to 7 tiles + a "+N Show more" tile. Click it to
 * reveal the rest and turn the row into a horizontal scroll-snap carousel.
 */
export const ManyMechanics: Story = {
  render: () => {
    const manyTiles: RoleTile[] = Array.from({length: 13}, (_, i) => ({
      role: `mechanic-${i}`,
      label: `Mechanic ${i + 1}`,
      description: 'An example mechanic that rewards a particular play pattern',
      count: 13 - i,
    }));
    return <InteractiveTileRow tiles={manyTiles} />;
  },
};

/** The desktop row's placeholder while the cards load (#914), or the tiles load again (#930). */
export const Loading: Story = {
  render: () => (
    <RoleTiles status="loading" onRetry={fn()} tiles={[]} activeRoles={new Set()} onToggle={fn()} />
  ),
};

/**
 * The tiles failed to load while the cards loaded (#930): the row's box says so, with a Try
 * again that loads the tiles alone.
 */
export const Failed: Story = {
  render: () => (
    <RoleTiles status="failed" onRetry={fn()} tiles={[]} activeRoles={new Set()} onToggle={fn()} />
  ),
};
