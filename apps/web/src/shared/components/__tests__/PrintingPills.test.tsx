import type {ComponentProps} from 'react';
import {describe, it, expect, vi} from 'vitest';
import {render, screen, fireEvent} from '@testing-library/react';
import {PrintingPills} from '../PrintingPills';

const PRINTINGS: ComponentProps<typeof PrintingPills>['printings'] = [
  {key: 'standard', label: 'Standard'},
  {key: '2141', label: 'Enchanted', rarity: 'Enchanted' as const},
];

function renderPills(index = 0, printings = PRINTINGS) {
  const onSelect = vi.fn();
  render(<PrintingPills printings={printings} index={index} onSelect={onSelect} />);
  return onSelect;
}

describe('PrintingPills', () => {
  it('renders nothing for a card with a single printing', () => {
    const {container} = render(
      <PrintingPills printings={[PRINTINGS[0]]} index={0} onSelect={() => {}} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('is a "Card printing" radio group with the shown printing checked', () => {
    renderPills(1);

    expect(screen.getByRole('radiogroup', {name: 'Card printing'})).toBeInTheDocument();
    expect(screen.getByRole('radio', {name: 'Enchanted'})).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', {name: 'Standard'})).toHaveAttribute('aria-checked', 'false');
  });

  it('selects a printing on click', () => {
    const onSelect = renderPills(0);

    fireEvent.click(screen.getByRole('radio', {name: 'Enchanted'}));

    expect(onSelect).toHaveBeenCalledWith(1);
  });

  it('keeps only the checked printing in the tab order', () => {
    renderPills(1);

    expect(screen.getByRole('radio', {name: 'Enchanted'})).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('radio', {name: 'Standard'})).toHaveAttribute('tabindex', '-1');
  });

  it('moves the selection and focus with the arrow keys, wrapping at the ends', () => {
    const onSelect = renderPills(0);
    const standard = screen.getByRole('radio', {name: 'Standard'});

    fireEvent.keyDown(standard, {key: 'ArrowLeft'});

    expect(onSelect).toHaveBeenCalledWith(1);
    expect(screen.getByRole('radio', {name: 'Enchanted'})).toHaveFocus();
  });

  it("marks each variant with its rarity's symbol and leaves Standard plain", () => {
    renderPills();

    const symbol = screen.getByRole('radio', {name: 'Enchanted'}).querySelector('img');
    expect(symbol).toHaveAttribute('src', expect.stringContaining('enchanted'));
    expect(screen.getByRole('radio', {name: 'Standard'}).querySelector('img')).toBeNull();
  });

  // A tap fires an emulated mouseenter but no mouseleave, so a hand-rolled hover would stay
  // lit after a swipe moves the selection, and two pills would look picked.
  it('does not light a pill up for the mouse events a tap emulates', () => {
    renderPills(0);
    const enchanted = screen.getByRole('radio', {name: 'Enchanted'});
    const unlit = enchanted.style.color;

    fireEvent.touchStart(enchanted);
    fireEvent.mouseEnter(enchanted);

    expect(enchanted.style.color).toBe(unlit);
  });

  it('with three or more printings, shows each variant by its symbol alone, still named for screen readers and on hover', () => {
    renderPills(0, [...PRINTINGS, {key: '2200', label: 'Epic', rarity: 'Epic' as const}]);

    const epic = screen.getByRole('radio', {name: 'Epic'});
    expect(epic).not.toHaveTextContent('Epic');
    expect(epic).toHaveAttribute('title', 'Epic');
    expect(screen.getByRole('radio', {name: 'Standard'})).toHaveTextContent('Standard');
  });
});
