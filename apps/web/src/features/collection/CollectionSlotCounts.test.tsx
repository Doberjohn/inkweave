import {describe, it, expect, vi} from 'vitest';
import {fireEvent, render, screen} from '@testing-library/react';
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

  describe('opened, while a mouse points at the pocket (#826)', () => {
    it('asks for the count one click away, and never for less than 0', () => {
      const onChange = vi.fn();
      render(<CollectionSlotCounts counts={{normal: 0, foil: 2}} editor={{foilOnly: false, onChange}} />);
      // The pills sit under aria-hidden, so a role query must ask for hidden elements.
      const button = (name: string) => screen.getByRole('button', {name, hidden: true});
      fireEvent.click(button('Remove one copy of normal'));
      fireEvent.click(button('Remove one copy of foil'));
      fireEvent.click(button('Add one copy of normal'));
      expect(onChange.mock.calls).toEqual([
        ['foil', 1],
        ['normal', 1],
      ]);
    });

    it('keeps its − and + out of the Tab order, which leaves a spread one Tab stop (#790)', () => {
      const {container} = render(
        <CollectionSlotCounts counts={{normal: 1, foil: 0}} editor={{foilOnly: false, onChange: vi.fn()}} />,
      );
      const buttons = [...container.querySelectorAll('button')];
      // Both pills' − and +: an empty list would pass `every` with nothing checked.
      expect(buttons).toHaveLength(4);
      expect(buttons.every((b) => b.tabIndex === -1)).toBe(true);
    });
  });
});
