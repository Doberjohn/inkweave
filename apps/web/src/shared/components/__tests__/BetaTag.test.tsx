import {describe, expect, it} from 'vitest';
import {render, screen} from '@testing-library/react';
import {BetaTag} from '../BetaTag';

describe('BetaTag', () => {
  it('renders the Beta label as an uppercase gold chip', () => {
    render(<BetaTag />);
    const tag = screen.getByText('Beta');
    expect(tag.style.textTransform).toBe('uppercase');
    expect(tag.style.color).toBe('rgb(255, 185, 0)'); // COLORS.primary
  });

  it('merges caller style overrides last', () => {
    render(<BetaTag style={{marginLeft: 8}} />);
    expect(screen.getByText('Beta').style.marginLeft).toBe('8px');
  });
});
