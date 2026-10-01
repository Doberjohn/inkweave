import {describe, it, expect, vi, beforeEach} from 'vitest';
import {render, screen, fireEvent, act} from '@testing-library/react';
import type {DetailedPairSynergy} from 'inkweave-synergy-engine';
import {createCard} from '../../../../shared/test-utils';
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
