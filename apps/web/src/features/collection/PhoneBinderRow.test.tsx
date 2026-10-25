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

const options = () => screen.getByRole('button', {name: 'Binder options'});

describe('PhoneBinderRow (#969)', () => {
  it('holds the set button, Binder options and Collection, in that order', () => {
    renderRow();
    expect(screen.getAllByRole('button').map((button) => button.getAttribute('aria-label') ?? button.textContent)).toEqual([
      'Binder set: Winterspell',
      'Binder options',
      'Collection',
    ]);
  });

  it('opens the Binder sheet from Binder options', () => {
    const {onOpen} = renderRow();
    fireEvent.click(options());
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it("counts what is on in Binder options' badge", () => {
    renderRow(2);
    expect(options()).toHaveTextContent(/^2$/);
  });

  it('draws no badge while nothing is on', () => {
    renderRow(0);
    expect(options()).toHaveTextContent(/^$/);
  });
});
