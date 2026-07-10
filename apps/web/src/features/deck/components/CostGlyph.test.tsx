import {describe, it, expect} from 'vitest';
import {render, screen} from '@testing-library/react';
import {CostGlyph} from './CostGlyph';

describe('CostGlyph', () => {
  it('renders the cost number for a normal cost', () => {
    render(<CostGlyph cost={3} inkwell />);
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('renders "9+" for cost 9', () => {
    render(<CostGlyph cost={9} inkwell />);
    expect(screen.getByText('9+')).toBeInTheDocument();
  });

  it('renders "9+" for costs above 9', () => {
    render(<CostGlyph cost={12} inkwell />);
    expect(screen.getByText('9+')).toBeInTheDocument();
  });

  it('renders the Inkable symbol when inkwell is true', () => {
    render(<CostGlyph cost={3} inkwell />);
    expect(screen.getByAltText('Inkable')).toBeInTheDocument();
  });

  it('renders the Uninkable symbol when inkwell is false', () => {
    render(<CostGlyph cost={4} inkwell={false} />);
    expect(screen.getByAltText('Uninkable')).toBeInTheDocument();
  });
});
