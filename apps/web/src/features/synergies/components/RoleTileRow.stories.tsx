import {useState} from 'react';
import type {Meta, StoryObj} from '@storybook/react-vite';
import {RoleTileRow, type RoleTile} from './RoleTileRow';

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
  parameters: {layout: 'fullscreen', backgrounds: {default: 'dark'}},
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{padding: 24, background: '#0d0d14', minHeight: 240}}>
        <Story />
      </div>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof RoleTileRow>;

/** Wraps RoleTileRow with local active-role state so stories show real toggle behavior. */
function InteractiveTileRow({tiles}: {tiles: RoleTile[]}) {
  const [activeRoles, setActiveRoles] = useState<Set<string>>(() => new Set());
  const toggle = (role: string) => {
    setActiveRoles((prev) => {
      const next = new Set(prev);
      if (next.has(role)) next.delete(role);
      else next.add(role);
      return next;
    });
  };
  return <RoleTileRow tiles={tiles} activeRoles={activeRoles} onToggle={toggle} />;
}

export const Default: Story = {
  render: () => <InteractiveTileRow tiles={locationTiles} />,
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
