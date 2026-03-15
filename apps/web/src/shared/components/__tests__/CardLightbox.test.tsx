import {describe, it, expect, vi} from 'vitest';
import {render, screen, fireEvent} from '@testing-library/react';
import {CardLightbox} from '../CardLightbox';

describe('CardLightbox', () => {
  const defaultProps = {
    src: 'https://example.com/card.png',
    alt: 'Elsa — Snow Queen',
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render the enlarged card image', () => {
    render(<CardLightbox {...defaultProps} />);
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', defaultProps.src);
    expect(img).toHaveAttribute('alt', defaultProps.alt);
  });

  it('should render an accessible modal dialog', () => {
    render(<CardLightbox {...defaultProps} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-label', `Enlarged view of ${defaultProps.alt}`);
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('should call onClose when backdrop is clicked', () => {
    render(<CardLightbox {...defaultProps} />);
    fireEvent.click(screen.getByRole('dialog'));
    expect(defaultProps.onClose).toHaveBeenCalledOnce();
  });

  it('should not call onClose when the image itself is clicked', () => {
    render(<CardLightbox {...defaultProps} />);
    fireEvent.click(screen.getByRole('img'));
    expect(defaultProps.onClose).not.toHaveBeenCalled();
  });

  it('should call onClose when Escape key is pressed', () => {
    render(<CardLightbox {...defaultProps} />);
    fireEvent.keyDown(document, {key: 'Escape'});
    expect(defaultProps.onClose).toHaveBeenCalledOnce();
  });

  it('should show fallback message when image fails to load', () => {
    render(<CardLightbox {...defaultProps} />);
    fireEvent.error(screen.getByRole('img'));
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('Image could not be loaded')).toBeInTheDocument();
  });

  it('should rotate location card images 90 degrees', () => {
    render(<CardLightbox {...defaultProps} isLocation />);
    const img = screen.getByRole('img');
    expect(img.style.transform).toBe('rotate(90deg)');
  });

  it('should not rotate non-location card images', () => {
    render(<CardLightbox {...defaultProps} />);
    const img = screen.getByRole('img');
    expect(img.style.transform).toBe('');
  });

  it('should lock body scroll when open', () => {
    const {unmount} = render(<CardLightbox {...defaultProps} />);
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).toBe('');
  });
});
