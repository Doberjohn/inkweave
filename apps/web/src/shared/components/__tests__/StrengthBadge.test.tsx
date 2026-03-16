import {describe, it, expect} from 'vitest';
import {render, screen} from '@testing-library/react';
import {StrengthBadge} from '../StrengthBadge';
import type {StrengthTier} from '../../../features/synergies/utils/scoreUtils';

const strongTier: StrengthTier = {
  label: 'Strong',
  shortLabel: 'Strong',
  color: '#6ee7a0',
  bg: '#1a3d1a',
};

describe('StrengthBadge', () => {
  it('renders children text', () => {
    render(<StrengthBadge tier={strongTier}>Strong 7</StrengthBadge>);
    expect(screen.getByText('Strong 7')).toBeTruthy();
  });

  it('applies tier colors as background and text', () => {
    render(<StrengthBadge tier={strongTier}>7</StrengthBadge>);
    const badge = screen.getByText('7');
    expect(badge.style.background).toBe('rgb(26, 61, 26)');
    expect(badge.style.color).toBe('rgb(110, 231, 160)');
  });

  it('applies data-testid when provided', () => {
    render(
      <StrengthBadge tier={strongTier} testId="reason-tag">
        7
      </StrengthBadge>,
    );
    expect(screen.getByTestId('reason-tag')).toBeTruthy();
  });

  it('applies title attribute for tooltips', () => {
    render(
      <StrengthBadge tier={strongTier} title="Shift synergy">
        7
      </StrengthBadge>,
    );
    expect(screen.getByTitle('Shift synergy')).toBeTruthy();
  });
});
