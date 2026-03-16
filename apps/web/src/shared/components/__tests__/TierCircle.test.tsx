import {describe, it, expect} from 'vitest';
import {render, screen} from '@testing-library/react';
import {TierCircle} from '../TierCircle';
import type {StrengthTier} from '../../../features/synergies/utils/scoreUtils';

const moderateTier: StrengthTier = {
  label: 'Moderate',
  shortLabel: 'Mod',
  color: '#60b5f5',
  bg: '#10253d',
};

describe('TierCircle', () => {
  it('renders children value', () => {
    render(<TierCircle tier={moderateTier}>5</TierCircle>);
    expect(screen.getByText('5')).toBeTruthy();
  });

  it('applies tier colors', () => {
    render(<TierCircle tier={moderateTier}>3</TierCircle>);
    const circle = screen.getByText('3');
    expect(circle.style.background).toBe('rgb(16, 37, 61)');
    expect(circle.style.color).toBe('rgb(96, 181, 245)');
  });

  it('uses 28px size for md variant', () => {
    render(
      <TierCircle tier={moderateTier} size="md">
        3
      </TierCircle>,
    );
    expect(screen.getByText('3').style.width).toBe('28px');
  });

  it('uses 22px size for sm variant', () => {
    render(
      <TierCircle tier={moderateTier} size="sm">
        3
      </TierCircle>,
    );
    expect(screen.getByText('3').style.width).toBe('22px');
  });
});
