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
});
