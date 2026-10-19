import {describe, it, expect} from 'vitest';
import {render, screen} from '@testing-library/react';
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
});
