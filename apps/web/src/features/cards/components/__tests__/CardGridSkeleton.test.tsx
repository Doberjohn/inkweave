import {describe, it, expect, vi} from 'vitest';
import {render, screen} from '@testing-library/react';
import {CardGridSkeleton} from '../CardGridSkeleton';
import {LAYOUT, SPACING} from '../../../../shared/constants';

const {layout} = vi.hoisted(() => ({layout: {width: 0, isMobile: false}}));

// jsdom lays nothing out: the grid's width and the viewport are what each case sets.
vi.mock('inkweave-ui/hooks/useContainerWidth', () => ({useContainerWidth: () => layout.width}));
vi.mock('inkweave-ui/hooks/useResponsive', () => ({
  useResponsive: () => ({isMobile: layout.isMobile, isTablet: false, isDesktop: !layout.isMobile, windowWidth: 0}),
}));

function renderGrid(width: number, isMobile: boolean, minColWidth?: number) {
  layout.width = width;
  layout.isMobile = isMobile;
  render(<CardGridSkeleton rows={1} minColWidth={minColWidth} />);
  const grid = screen.getByLabelText('Loading cards').firstElementChild as HTMLElement;
  return {grid, tiles: [...grid.children] as HTMLElement[]};
}

/** A column's width for a grid of `columns`, with the skeleton's default gap. */
const columnWidth = (width: number, columns: number) => (width - SPACING.md * (columns - 1)) / columns;

// #914: the skeleton picks its columns as the loaded grid does, so nothing reflows when cards land.
describe('CardGridSkeleton', () => {
  it("gives a phone the loaded grid's two columns", () => {
    const {grid, tiles} = renderGrid(358, true);
    expect(LAYOUT.cardGridMinWidthMobile).toBe(140);
    expect(grid.style.gridTemplateColumns).toBe('repeat(2, 1fr)');
    expect(tiles).toHaveLength(2);
  });

  it("takes the loaded grid's minimum when given one", () => {
    // Browse's phone grid has its own: three 96px columns fit 358px, gaps included.
    const {grid, tiles} = renderGrid(358, true, LAYOUT.browseGridMinWidthMobile);
    expect(grid.style.gridTemplateColumns).toBe('repeat(3, 1fr)');
    expect(tiles).toHaveLength(3);
  });

  it('gives a wide desktop grid seven columns, at the desktop minimum', () => {
    const {grid, tiles} = renderGrid(1408, false);
    expect(grid.style.gridTemplateColumns).toBe('repeat(7, 1fr)');
    expect(tiles).toHaveLength(7);
  });

  it('draws each tile exactly a card of its column tall, with no line box around it', () => {
    const {grid, tiles} = renderGrid(358, true);
    for (const tile of tiles) expect(tile.style.height).toBe(`${columnWidth(358, 2) / 0.72}px`);
    expect(grid.querySelector('br')).toBeNull();
  });

  it('adds no padding of its own unless the grid it stands for has some', () => {
    layout.width = 1408;
    layout.isMobile = false;
    render(<CardGridSkeleton />);
    expect(screen.getByLabelText('Loading cards').style.padding).toBe('0px');
  });
});
