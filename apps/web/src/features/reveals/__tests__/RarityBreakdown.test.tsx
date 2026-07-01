import {describe, it, expect, vi} from 'vitest';
import {render, screen, fireEvent} from '@testing-library/react';
import {RarityBreakdown} from '../RarityBreakdown';

const counts = {common: 6, uncommon: 5, rare: 6, 'super rare': 3, legendary: 0};

describe('RarityBreakdown', () => {
  it('fires onSelectRarity with the chip key when an interactive chip is clicked', () => {
    const onSelect = vi.fn();
    render(<RarityBreakdown rarityCounts={counts} selectedRarity={null} onSelectRarity={onSelect} />);
    fireEvent.click(screen.getByRole('button', {name: 'Highlight Rare cards'}));
    expect(onSelect).toHaveBeenCalledWith('rare');
  });

  it('renders a zero-count rarity as a non-interactive chip', () => {
    render(<RarityBreakdown rarityCounts={counts} selectedRarity={null} onSelectRarity={vi.fn()} />);
    expect(screen.queryByRole('button', {name: 'Highlight Legendary cards'})).toBeNull();
  });

  it('marks the selected chip aria-pressed', () => {
    render(<RarityBreakdown rarityCounts={counts} selectedRarity="rare" onSelectRarity={vi.fn()} />);
    expect(screen.getByRole('button', {name: 'Highlight Rare cards'})).toHaveAttribute('aria-pressed', 'true');
  });

  it('renders non-interactive chips when no handler is provided', () => {
    render(<RarityBreakdown rarityCounts={counts} />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
