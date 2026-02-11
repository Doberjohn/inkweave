import {describe, it, expect} from 'vitest';
import {render, screen} from '@testing-library/react';
import {CostIcon} from '../CostIcon';

describe('CostIcon', () => {
  it('should display the cost number for costs 1-8', () => {
    render(<CostIcon cost={5} />);
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('should display "9+" for cost 9', () => {
    render(<CostIcon cost={9} />);
    expect(screen.getByText('9+')).toBeInTheDocument();
  });

  it('should display "9+" for costs above 9', () => {
    render(<CostIcon cost={12} />);
    expect(screen.getByText('9+')).toBeInTheDocument();
  });

  it('should render the inkable SVG', () => {
    const {container} = render(<CostIcon cost={3} />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('should apply custom size', () => {
    const {container} = render(<CostIcon cost={1} size={48} />);
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.style.width).toBe('48px');
    expect(wrapper.style.height).toBe('48px');
  });
});
