import {describe, it, expect, vi} from 'vitest';
import {render, screen, fireEvent} from '@testing-library/react';
import {RarityBreakdown} from '../RarityBreakdown';
import {SPECIAL_RARITIES} from '../rarity';

const counts = {common: 6, uncommon: 5, rare: 6, 'super rare': 3, legendary: 0};

describe('RarityBreakdown', () => {
  it('fires onSelectRarity with the chip key when a chip is clicked', () => {
    const onSelect = vi.fn();
    render(<RarityBreakdown rarityCounts={counts} onSelectRarity={onSelect} />);
    fireEvent.click(screen.getByRole('button', {name: 'Rare 6'}));
    expect(onSelect).toHaveBeenCalledWith('rare');
  });

  it('gives a rarity with nothing revealed no chip', () => {
    render(<RarityBreakdown rarityCounts={counts} onSelectRarity={vi.fn()} />);
    expect(screen.queryByRole('button', {name: /^Legendary/})).toBeNull();
  });

  it('marks the selected chip aria-pressed', () => {
    render(<RarityBreakdown rarityCounts={counts} selectedRarity="rare" onSelectRarity={vi.fn()} />);
    expect(screen.getByRole('button', {name: 'Rare 6'})).toHaveAttribute('aria-pressed', 'true');
  });

  it('adds the revealed special printing rarities after the five', () => {
    render(
      <RarityBreakdown
        rarityCounts={{...counts, enchanted: 2}}
        specialRarities={[SPECIAL_RARITIES.Epic, SPECIAL_RARITIES.Enchanted]}
        onSelectRarity={vi.fn()}
      />,
    );
    const chips = screen.getAllByRole('button').map((chip) => chip.textContent ?? '');
    expect(chips.at(-1)).toBe('Enchanted 2');
    expect(chips.some((chip) => chip.startsWith('Epic'))).toBe(false); // none revealed, so no chip
  });
});
