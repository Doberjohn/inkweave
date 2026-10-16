import {describe, it, expect} from 'vitest';
import {render, screen} from '@testing-library/react';
import {CollectionSlotCounts} from './CollectionSlotCounts';

describe('CollectionSlotCounts', () => {
  it('renders nothing for an unowned card', () => {
    const {container} = render(<CollectionSlotCounts counts={{normal: 0, foil: 0}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('labels only the finishes held', () => {
    render(<CollectionSlotCounts counts={{normal: 0, foil: 2}} />);
    expect(screen.getByRole('group', {name: '2 foil'})).toBeInTheDocument();
  });

  it('is read-only: no control can be reached by keyboard', () => {
    // Collapsed steppers keep their − and + in the DOM at zero width. Checked by
    // tabIndex, not by role: the pills sit under `aria-hidden`, which hides them
    // from a role query even when expanded but does nothing to stop Tab landing
    // on a button.
    const {container} = render(<CollectionSlotCounts counts={{normal: 3, foil: 1}} />);
    const buttons = [...container.querySelectorAll('button')];
    expect(buttons.length).toBeGreaterThan(0);
    expect(buttons.every((b) => b.tabIndex === -1)).toBe(true);
  });
});
