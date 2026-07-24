import {describe, expect, it} from 'vitest';
import {render, screen} from '@testing-library/react';
import {TypeSplitPips} from './TypeSplitPips';

describe('TypeSplitPips', () => {
  it('renders a pip per held type in canonical order (Character, Action, Item, Location)', () => {
    render(<TypeSplitPips typeDistribution={{Location: 2, Character: 34, Item: 6, Action: 18}} />);
    // The "Types" caption precedes the pip row; the pips must read in canonical order
    // regardless of the input key order.
    expect(screen.getByLabelText('Card type split').textContent).toBe('Types34 Character18 Action6 Item2 Location');
  });

  it('omits types the deck does not hold rather than showing a zero pip', () => {
    render(<TypeSplitPips typeDistribution={{Character: 42, Action: 18}} />);
    expect(screen.getByText('Character')).toBeInTheDocument();
    expect(screen.queryByText('Item')).not.toBeInTheDocument();
    expect(screen.queryByText('Location')).not.toBeInTheDocument();
  });

  it('renders nothing for an empty deck so a fresh build stays clean', () => {
    const {container} = render(<TypeSplitPips typeDistribution={{}} />);
    expect(container).toBeEmptyDOMElement();
  });
});
