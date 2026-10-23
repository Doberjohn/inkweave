import {describe, it, expect} from 'vitest';
import {render, screen} from '@testing-library/react';
import {COLORS} from '../../../shared/constants';
import {RevealHero} from '../RevealHero';

const SEASON = {releaseDate: 'October 23', totalRevealed: 204, franchiseCount: 3};

describe('RevealHero', () => {
  it('names the milestone the countdown runs to, with a singular day', () => {
    render(<RevealHero {...SEASON} countdown={{days: 1, milestone: 'store-release'}} />);
    expect(screen.getByText('Until store release')).toBeVisible();
    expect(screen.getByText('day')).toBeVisible();
  });

  it('hides the countdown until the reveal dates load', () => {
    render(<RevealHero {...SEASON} countdown={null} />);
    expect(screen.getByText('Until pre-release')).not.toBeVisible();
  });

  // WCAG 1.4.3 (accessibility check, 2026-10-19): in textDim the total measured 3.3:1 on the hero.
  it('draws the set total after the revealed count in textMuted', () => {
    render(<RevealHero {...SEASON} countdown={null} />);
    expect(screen.getByText(/^\/ \d+$/)).toHaveStyle({color: COLORS.textMuted});
  });

  // #913: the card list counts 0 until it loads; the hero waits for it instead.
  it('holds a busy placeholder, not 0, before the set total while the cards load', () => {
    const {container} = render(<RevealHero {...SEASON} totalRevealed={null} countdown={null} />);
    const total = screen.getByText(/^\/ \d+$/);
    // No number before the total: the skeleton holds its place.
    expect(total.parentElement?.textContent).toMatch(/^\D* \/ 204$/);
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
  });
});
