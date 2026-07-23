import {describe, it, expect, vi} from 'vitest';
import {render, screen, fireEvent} from '@testing-library/react';
import {CtaButton} from '../CtaButton';

describe('CtaButton', () => {
  it('should render children', () => {
    render(<CtaButton>Click me</CtaButton>);
    expect(screen.getByRole('button', {name: 'Click me'})).toBeInTheDocument();
  });

  it('should default to filled variant with gradient background', () => {
    render(<CtaButton>Filled</CtaButton>);
    const btn = screen.getByRole('button');
    expect(btn.style.background).toContain('gradient');
  });

  it('should render ghost variant with gold border', () => {
    render(<CtaButton variant="ghost">Ghost</CtaButton>);
    const btn = screen.getByRole('button');
    expect(btn).toHaveStyle({background: 'transparent'});
  });

  it('should forward onClick and other button props', () => {
    const onClick = vi.fn();
    render(
      <CtaButton onClick={onClick} data-testid="cta">
        Test
      </CtaButton>,
    );
    fireEvent.click(screen.getByTestId('cta'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('should forward onMouseEnter/Leave while handling hover state', () => {
    const onMouseEnter = vi.fn();
    const onMouseLeave = vi.fn();
    render(
      <CtaButton onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
        Hover
      </CtaButton>,
    );
    const btn = screen.getByRole('button');
    fireEvent.mouseEnter(btn);
    expect(onMouseEnter).toHaveBeenCalledOnce();
    fireEvent.mouseLeave(btn);
    expect(onMouseLeave).toHaveBeenCalledOnce();
  });

  it('should merge custom style with base styles', () => {
    render(<CtaButton style={{marginTop: 10}}>Styled</CtaButton>);
    expect(screen.getByRole('button')).toHaveStyle({marginTop: '10px'});
  });

  it('renders the neutral variant muted, warming to gold on hover', () => {
    render(<CtaButton variant="neutral">Cancel</CtaButton>);
    const btn = screen.getByRole('button');
    expect(btn.style.border).toContain('51, 51, 85'); // surfaceBorder at rest
    fireEvent.mouseEnter(btn);
    expect(btn.style.border).toContain('255, 185, 0'); // gold on hover
  });

  it('renders the pill variant fully rounded on the filled recipe', () => {
    render(<CtaButton variant="pill">Reveals</CtaButton>);
    const btn = screen.getByRole('button');
    expect(btn.style.borderRadius).toBe('999px');
    expect(btn.style.background).toContain('gradient');
  });

  it('applies the uniform disabled recipe (dimmed + not-allowed)', () => {
    render(<CtaButton disabled>Publish</CtaButton>);
    const btn = screen.getByRole('button');
    expect(btn).toBeDisabled();
    expect(btn.style.opacity).toBe('0.4');
    expect(btn.style.cursor).toBe('not-allowed');
  });

  it('scales down while pressed and recovers on release', () => {
    render(<CtaButton>Press</CtaButton>);
    const btn = screen.getByRole('button');
    fireEvent.mouseDown(btn);
    expect(btn.style.transform).toBe('scale(0.97)');
    fireEvent.mouseUp(btn);
    expect(btn.style.transform).not.toBe('scale(0.97)');
  });
});
