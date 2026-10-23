import {describe, it, expect, vi} from 'vitest';
import {render, screen, fireEvent} from '@testing-library/react';
import {CollectionModeSwitch} from './CollectionModeSwitch';

function renderSwitch() {
  const onToggle = vi.fn();
  const onIntent = vi.fn();
  render(<CollectionModeSwitch active={false} onToggle={onToggle} onIntent={onIntent} />);
  return {onToggle, onIntent, button: screen.getByRole('button', {name: 'Show my collection'})};
}

describe('CollectionModeSwitch', () => {
  // #913: Browse warms the binder's chunk on each of these, so it is usually in by the press.
  it.each([
    ['a pointer over it', fireEvent.pointerEnter],
    ['focus on it', fireEvent.focus],
    ['a press starting', fireEvent.pointerDown],
  ] as const)('tells onIntent about %s, before any toggle', (_, fire) => {
    const {onToggle, onIntent, button} = renderSwitch();
    fire(button);
    expect(onIntent).toHaveBeenCalledOnce();
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('toggles the mode on a click', () => {
    const {onToggle, button} = renderSwitch();
    fireEvent.click(button);
    expect(onToggle).toHaveBeenCalledOnce();
  });
});
