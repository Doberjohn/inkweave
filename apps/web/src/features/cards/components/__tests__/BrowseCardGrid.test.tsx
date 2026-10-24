import {describe, it, expect, vi} from 'vitest';
import {render, screen} from '@testing-library/react';
import {BrowseCardGrid} from '../BrowseCardGrid';
import {createCard} from '../../../../shared/test-utils';

const layout = vi.hoisted(() => ({isMobile: false}));

vi.mock('../../../../shared/hooks/useResponsive', () => ({
  useResponsive: () => ({
    isMobile: layout.isMobile,
    isTablet: false,
    isDesktop: !layout.isMobile,
    windowWidth: 0,
  }),
}));

const cards = (count: number) =>
  Array.from({length: count}, (_, i) =>
    createCard({id: String(1000 + i), fullName: `Card ${i} - Test`}),
  );

function renderGrid(count: number, isMobile: boolean) {
  layout.isMobile = isMobile;
  render(<BrowseCardGrid cards={cards(count)} isLoading={false} onCardSelect={vi.fn()} />);
  return screen.queryAllByTestId('card-tile');
}

// jsdom never lays the grid out, so what renders here is what VirtuosoGrid draws before it has
// measured its box: the app's first frame after the prerendered page (#915).
describe('BrowseCardGrid before it has measured its box', () => {
  it('draws the tiles above the fold of a 1440x900 screen', () => {
    expect(renderGrid(40, false)).toHaveLength(15);
  });

  it('draws the tiles above the fold of a 390x844 phone', () => {
    expect(renderGrid(40, true)).toHaveLength(6);
  });

  it('draws every card when fewer than a fold match', () => {
    expect(renderGrid(4, false)).toHaveLength(4);
  });
});
