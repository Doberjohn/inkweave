import {describe, it, expect, vi} from 'vitest';
import {fireEvent, render, screen} from '@testing-library/react';
import {PhoneBinderRow} from './PhoneBinderRow';

function renderRow(count = 0) {
  const onOpen = vi.fn();
  render(
    <PhoneBinderRow
      setPicker={<button>Binder set: Winterspell</button>}
      count={count}
      onOpen={onOpen}
      modeSwitch={<button>Collection</button>}
    />,
  );
  return {onOpen};
}

const filters = () => screen.getByRole('button', {name: /^Filters/});

describe('PhoneBinderRow (#969)', () => {
  it("holds Filters, the set button and Collection, in that order, as grid mode's row (#1000)", () => {
    renderRow();
    expect(screen.getAllByRole('button').map((button) => button.getAttribute('aria-label') ?? button.textContent)).toEqual([
      'Filters',
      'Binder set: Winterspell',
      'Collection',
    ]);
  });

  it('gives the set button the room Filters and Collection leave', () => {
    renderRow();
    expect(screen.getByRole('button', {name: 'Binder set: Winterspell'}).parentElement!.style.flex).toBe('1 1 0%');
  });

  it('opens the Binder sheet from Filters', () => {
    const {onOpen} = renderRow();
    fireEvent.click(filters());
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it("counts what is on in Filters' badge, and says it in the button's name", () => {
    renderRow(2);
    expect(filters()).toHaveTextContent(/^Filters2$/);
    expect(filters()).toHaveAccessibleName('Filters, 2 on');
  });

  it('draws no badge while nothing is on, and names no count', () => {
    renderRow(0);
    expect(filters()).toHaveTextContent(/^Filters$/);
    expect(filters()).toHaveAccessibleName('Filters');
  });
});
