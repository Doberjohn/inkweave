import {describe, it, expect} from 'vitest';
import {render} from '@testing-library/react';
import {COLORS, INK_COLORS} from '../constants';
import {InkCardPlaceholder} from './InkCardPlaceholder';

function renderTile(props: Parameters<typeof InkCardPlaceholder>[0] = {}) {
  const {container} = render(<InkCardPlaceholder {...props} />);
  return container.querySelector<HTMLElement>('.ink-card-placeholder')!;
}

describe('InkCardPlaceholder', () => {
  it('names the ink its symbol shows and glows in its color', () => {
    const tile = renderTile({ink: 'Amethyst'});
    expect(tile.dataset.ink).toBe('Amethyst');
    expect(tile.dataset.ink2).toBeUndefined();
    expect(tile.style.getPropertyValue('--ink')).toBe(INK_COLORS.Amethyst.border);
  });

  it("gives a dual-ink card's second ink a symbol and a glow of its own", () => {
    const tile = renderTile({ink: 'Amethyst', ink2: 'Sapphire'});
    expect(tile.dataset.ink2).toBe('Sapphire');
    expect(tile.style.getPropertyValue('--ink2')).toBe(INK_COLORS.Sapphire.border);
  });

  it('is the neutral tile, with the gold mark, while no card is known', () => {
    const tile = renderTile();
    expect(tile.dataset.ink).toBeUndefined();
    expect(tile.style.getPropertyValue('--ink')).toBe(COLORS.gray400);
    expect(tile.style.getPropertyValue('--ink-shine')).toBe(COLORS.primary);
  });

  it('is hidden from assistive tech', () => {
    expect(renderTile({ink: 'Ruby'})).toHaveAttribute('aria-hidden', 'true');
  });
});
