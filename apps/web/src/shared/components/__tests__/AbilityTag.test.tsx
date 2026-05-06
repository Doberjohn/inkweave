import {describe, it, expect} from 'vitest';
import {render, screen} from '@testing-library/react';
import {AbilityTag} from '../AbilityTag';

describe('AbilityTag', () => {
  it('renders children with uppercase styling', () => {
    render(<AbilityTag>Ramp</AbilityTag>);
    const tag = screen.getByText('Ramp');
    expect(tag).toBeTruthy();
    expect(tag.style.textTransform).toBe('uppercase');
  });

  it('defaults to the stacked variant when no variant prop is supplied', () => {
    render(<AbilityTag>Default</AbilityTag>);
    expect(screen.getByText('Default').style.borderRadius).toBe('4px 4px 0 0');
  });

  it('rounds the top corners on the stacked variant', () => {
    render(<AbilityTag variant="stacked">Ramp</AbilityTag>);
    expect(screen.getByText('Ramp').style.borderRadius).toBe('4px 4px 0 0');
  });

  it('uses larger font on the page variant with rounded top corners', () => {
    render(<AbilityTag variant="page">Locations</AbilityTag>);
    const tag = screen.getByText('Locations');
    expect(tag.style.fontSize).toBe('16px');
    expect(tag.style.borderRadius).toBe('4px 4px 0 0');
  });
});
