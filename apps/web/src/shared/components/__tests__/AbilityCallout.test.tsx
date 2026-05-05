import {describe, it, expect} from 'vitest';
import {render, screen} from '@testing-library/react';
import {AbilityCallout} from '../AbilityCallout';

describe('AbilityCallout', () => {
  it('renders children on a cream body', () => {
    render(<AbilityCallout>Speed up your ink</AbilityCallout>);
    expect(screen.getByText('Speed up your ink')).toBeTruthy();
  });

  it('rounds all corners on the standalone variant', () => {
    render(<AbilityCallout>Body</AbilityCallout>);
    expect(screen.getByText('Body').style.borderRadius).toBe('4px');
  });

  it('keeps the top-left corner flat on the stacked-after-tag variant', () => {
    render(<AbilityCallout variant="stacked-after-tag">Body</AbilityCallout>);
    expect(screen.getByText('Body').style.borderRadius).toBe('0 4px 4px 4px');
  });
});
