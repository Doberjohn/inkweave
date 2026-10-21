import {describe, it, expect, vi, beforeEach} from 'vitest';
import {render, screen, fireEvent, act} from '@testing-library/react';
import type {DetailedPairSynergy} from 'inkweave-synergy-engine';
import {createCard} from '../../../../shared/test-utils';
import {COLORS} from '../../../../shared/constants';
import {MobileComparisonView} from '../MobileComparisonView';

// The tabs and their strip are under test; the panels' own content is not.
vi.mock('../EngineColumn', () => ({EngineColumn: () => <p>Engine panel</p>}));
vi.mock('../CommunityColumn', () => ({CommunityColumn: () => <p>Community panel</p>}));
vi.mock('../../../voting/hooks/usePairScore', () => ({usePairScore: () => ({score: null})}));

const pair = {
  cardA: createCard({id: 'a', fullName: 'Card A - One'}),
  cardB: createCard({id: 'b', fullName: 'Card B - Two'}),
  aggregateScore: 5,
  connections: [],
} as unknown as DetailedPairSynergy;

let stripScrollTo: ReturnType<typeof vi.fn>;
let scrollIntoView: ReturnType<typeof vi.fn>;

beforeEach(() => {
  stripScrollTo = vi.fn();
  scrollIntoView = vi.fn();
  Element.prototype.scrollTo = stripScrollTo as unknown as Element['scrollTo'];
  Element.prototype.scrollIntoView = scrollIntoView as unknown as Element['scrollIntoView'];
});

/** The Engine | Community strip, given the width jsdom does not lay out. */
function tabStrip() {
  const strip = document.querySelector<HTMLElement>('.mobile-tab-viewport')!;
  Object.defineProperty(strip, 'clientWidth', {value: 340, configurable: true});
  return strip;
}

const communityTab = () => screen.getByRole('button', {name: /^Community/});

describe('MobileComparisonView tabs', () => {
  // WCAG 1.4.3 (accessibility check, 2026-10-19): textDim, and "/10" at 80% of its tab's colour,
  // missed 4.5:1 on the tabs.
  it("draws the inactive tab's text in textMuted, and the active tab's /10 in its full colour", () => {
    render(<MobileComparisonView pair={pair} engineScore={5} />);

    expect(screen.getByText('Community')).toHaveStyle({color: COLORS.textMuted});
    const scale = screen.getByText('/10');
    expect(scale).toHaveStyle({color: COLORS.primary});
    expect(scale.style.opacity).toBe('');
  });

  // WCAG 1.4.3: the glow orbs shine through the tabs and panels, right behind their text on short
  // phones, and at 35% they took labels down to 3.3:1.
  it('keeps its glow orbs at 15% opacity or fainter', () => {
    const {container} = render(<MobileComparisonView pair={pair} engineScore={5} />);

    const orbs = [...container.querySelectorAll<HTMLElement>('span')].filter((el) =>
      el.style.filter.startsWith('blur('),
    );
    expect(orbs).toHaveLength(3);
    for (const orb of orbs) expect(Number(orb.style.opacity)).toBeLessThanOrEqual(0.15);
  });

  // scrollIntoView would also scroll every scrollable ancestor (the modal, the page).
  it('switches to the Community tab by scrolling only its strip', () => {
    render(<MobileComparisonView pair={pair} engineScore={5} />);
    const strip = tabStrip();

    fireEvent.click(communityTab());

    expect(communityTab()).toHaveAttribute('aria-current', 'true');
    expect(stripScrollTo.mock.contexts).toEqual([strip]);
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it('follows a swipe of its strip', () => {
    render(<MobileComparisonView pair={pair} engineScore={5} />);
    const strip = tabStrip();
    strip.scrollLeft = 340;

    act(() => {
      fireEvent.scroll(strip);
    });

    expect(communityTab()).toHaveAttribute('aria-current', 'true');
  });
});
