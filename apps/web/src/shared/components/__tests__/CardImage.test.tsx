import {describe, it, expect} from 'vitest';
import {render, screen, fireEvent} from '@testing-library/react';
import {CardImage} from '../CardImage';

describe('CardImage', () => {
  const defaultProps = {
    src: 'https://example.com/card.jpg',
    alt: 'Test card',
    width: 60,
    height: 84,
    inkColor: 'Amber' as const,
    cost: 3,
  };

  it('should render image when src is provided', () => {
    render(<CardImage {...defaultProps} />);

    const img = screen.getByRole('img');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', defaultProps.src);
    expect(img).toHaveAttribute('alt', defaultProps.alt);
  });

  it('should use lazy loading by default', () => {
    render(<CardImage {...defaultProps} />);

    expect(screen.getByRole('img')).toHaveAttribute('loading', 'lazy');
  });

  it('should not use lazy loading when lazy=false', () => {
    render(<CardImage {...defaultProps} lazy={false} />);

    expect(screen.getByRole('img')).not.toHaveAttribute('loading');
  });

  it('should render alt-bearing img + fallback overlay when no src provided', () => {
    render(<CardImage {...defaultProps} src={undefined} />);

    // img is always rendered for DOM-selector stability (test/screen-reader access)
    const img = screen.getByRole('img');
    expect(img).toBeInTheDocument();
    expect(img).not.toHaveAttribute('src');
    expect(img).toHaveAttribute('alt', defaultProps.alt);
    // Fallback overlay shows the cost number
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('should show fallback overlay on image error (img stays in DOM)', () => {
    render(<CardImage {...defaultProps} />);

    const img = screen.getByRole('img');
    fireEvent.error(img);

    // img element is still present (alt attribute preserved); only the fallback overlay appears
    expect(img).toBeInTheDocument();
    expect(img).toHaveStyle({opacity: '0'});
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('should apply custom border radius to wrapper', () => {
    render(<CardImage {...defaultProps} borderRadius={12} />);

    const img = screen.getByRole('img');
    // Read the inline style attribute directly rather than going through
    // jest-dom's toHaveStyle → jsdom getComputedStyle → CSS parser. The
    // shorthand `borderRadius` resolution shifted between jsdom 29.0.x → 29.1.x
    // (dev-deps PR #310 surfaced this). Direct attribute access is version-
    // stable: borderRadius is on the wrapper div (clips via overflow:hidden).
    expect(img.parentElement?.style.borderRadius).toBe('12px');
  });
});
