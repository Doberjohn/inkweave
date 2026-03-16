import {describe, it, expect} from 'vitest';
import {render, screen} from '@testing-library/react';
import {Callout} from '../Callout';

describe('Callout', () => {
  it('renders children text', () => {
    render(<Callout>Cards that share a name with shift targets.</Callout>);
    expect(screen.getByText('Cards that share a name with shift targets.')).toBeTruthy();
  });

  it('renders inside a paragraph element', () => {
    render(<Callout>Description text</Callout>);
    const text = screen.getByText('Description text');
    expect(text.tagName).toBe('P');
  });

  it('has gold left border accent', () => {
    render(<Callout>Test</Callout>);
    const container = screen.getByText('Test').parentElement!;
    expect(container.style.borderLeft).toContain('solid');
  });
});
