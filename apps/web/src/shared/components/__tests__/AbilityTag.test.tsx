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

  it('applies banner clip-path on the row variant', () => {
    render(<AbilityTag variant="row">Ramp</AbilityTag>);
    expect(screen.getByText('Ramp').style.clipPath).toContain('polygon');
  });

  it('drops clip-path on the stacked variant and rounds the top corners', () => {
    render(<AbilityTag variant="stacked">Ramp</AbilityTag>);
    const tag = screen.getByText('Ramp');
    expect(tag.style.clipPath).toBe('');
    expect(tag.style.borderRadius).toBe('4px 4px 0 0');
  });

  it('defaults to the row variant when no variant prop is supplied', () => {
    render(<AbilityTag>Default</AbilityTag>);
    expect(screen.getByText('Default').style.clipPath).toContain('polygon');
  });

  it('uses larger font on the page variant with rounded top corners', () => {
    render(<AbilityTag variant="page">Locations</AbilityTag>);
    const tag = screen.getByText('Locations');
    expect(tag.style.fontSize).toBe('16px');
    expect(tag.style.borderRadius).toBe('4px 4px 0 0');
    expect(tag.style.clipPath).toBe('');
  });
});
