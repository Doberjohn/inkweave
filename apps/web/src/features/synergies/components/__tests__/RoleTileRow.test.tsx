import {describe, it, expect, vi} from 'vitest';
import {render, screen, fireEvent} from '@testing-library/react';
import {RoleTileRow, type RoleTile} from '../RoleTileRow';

const tiles: RoleTile[] = [
  {role: 'location', label: 'Locations', description: 'Location cards', count: 54},
  {role: 'boost', label: 'Boost', description: 'Boost description', count: 14},
  {role: 'search', label: 'Search', description: 'Search description', count: 7},
  {role: 'trigger', label: 'Trigger', description: 'Trigger description', count: 4},
];

describe('RoleTileRow', () => {
  it('renders nothing when tiles is empty', () => {
    const {container} = render(
      <RoleTileRow tiles={[]} activeRoles={new Set()} onToggle={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders all tiles with label, count, and description', () => {
    render(<RoleTileRow tiles={tiles} activeRoles={new Set()} onToggle={vi.fn()} />);
    expect(screen.getByText('Locations')).toBeInTheDocument();
    expect(screen.getByText('Boost')).toBeInTheDocument();
    expect(screen.getByText('54')).toBeInTheDocument();
    expect(screen.getByText('14')).toBeInTheDocument();
    expect(screen.getByText('Boost description')).toBeInTheDocument();
  });

  it('sorts role tiles by count descending, alphabetical on ties', () => {
    const tiedTiles: RoleTile[] = [
      {role: 'b', label: 'Bravo', description: '', count: 8},
      {role: 'a', label: 'Alpha', description: '', count: 8},
      {role: 'c', label: 'Charlie', description: '', count: 14},
    ];
    render(<RoleTileRow tiles={tiedTiles} activeRoles={new Set()} onToggle={vi.fn()} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons[0]).toHaveAccessibleName(/^Charlie\b/);
    expect(buttons[1]).toHaveAccessibleName(/^Alpha\b/);
    expect(buttons[2]).toHaveAccessibleName(/^Bravo\b/);
  });

  it('places highest-count tile first (Locations 54 outranks the rest)', () => {
    render(<RoleTileRow tiles={tiles} activeRoles={new Set()} onToggle={vi.fn()} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons[0]).toHaveAccessibleName(/^Locations\b/);
  });

  it('calls onToggle with the clicked role', () => {
    const onToggle = vi.fn();
    render(<RoleTileRow tiles={tiles} activeRoles={new Set()} onToggle={onToggle} />);
    fireEvent.click(screen.getByRole('button', {name: /^Boost\b/}));
    expect(onToggle).toHaveBeenCalledWith('boost');
  });

  it('reflects active state via aria-pressed', () => {
    render(
      <RoleTileRow tiles={tiles} activeRoles={new Set(['boost', 'search'])} onToggle={vi.fn()} />,
    );
    expect(screen.getByRole('button', {name: /^Boost\b/})).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', {name: /^Search\b/})).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', {name: /^Trigger\b/})).toHaveAttribute('aria-pressed', 'false');
  });

  it('supports multi-select toggle (clicking second tile keeps first active)', () => {
    let active = new Set<string>(['boost']);
    const onToggle = vi.fn((role: string) => {
      const next = new Set(active);
      if (next.has(role)) next.delete(role);
      else next.add(role);
      active = next;
    });
    render(<RoleTileRow tiles={tiles} activeRoles={active} onToggle={onToggle} />);
    fireEvent.click(screen.getByRole('button', {name: /^Search\b/}));
    expect(onToggle).toHaveBeenCalledWith('search');
    expect(active.has('boost')).toBe(true);
    expect(active.has('search')).toBe(true);
  });
});
