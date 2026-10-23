import {describe, it, expect, vi} from 'vitest';
import {render, screen, fireEvent} from '@testing-library/react';
import {CollectionActions} from './CollectionActions';

function renderActions(checking = false, onMenuOpen?: () => void) {
  const onImport = vi.fn();
  render(<CollectionActions onImport={onImport} checking={checking} onMenuOpen={onMenuOpen} />);
  return onImport;
}

const gear = () => screen.getByRole('button', {name: 'Collection actions'});
const importAction = () => screen.getByRole('menuitem', {name: /^Import collection/});

describe('CollectionActions', () => {
  it('is a gear named for the collection, its menu closed until pressed', () => {
    renderActions();
    expect(gear()).toHaveAttribute('aria-haspopup', 'menu');
    expect(gear()).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('opens on Import collection, which starts the import and closes the menu onto the gear', () => {
    const onImport = renderActions();
    fireEvent.click(gear());
    expect(gear()).toHaveAttribute('aria-expanded', 'true');
    expect(importAction()).toHaveFocus();
    fireEvent.click(importAction());
    expect(onImport).toHaveBeenCalledOnce();
    expect(screen.queryByRole('menu')).toBeNull();
    expect(gear()).toHaveFocus();
  });

  it('waits while the account is checked, as the Account page does: it says so and does nothing', () => {
    const onImport = renderActions(true);
    fireEvent.click(gear());
    expect(importAction()).toHaveAttribute('aria-disabled', 'true');
    expect(importAction()).toHaveTextContent('Checking your account…');
    fireEvent.click(importAction());
    expect(onImport).not.toHaveBeenCalled();
  });

  it('opens from the keyboard, and Escape closes it back onto the gear', () => {
    renderActions();
    fireEvent.keyDown(gear(), {key: 'ArrowDown'});
    expect(importAction()).toHaveFocus();
    fireEvent.keyDown(importAction(), {key: 'Escape'});
    expect(screen.queryByRole('menu')).toBeNull();
    expect(gear()).toHaveFocus();
  });

  it('closes on a press outside', () => {
    renderActions();
    fireEvent.click(gear());
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  // #913: Browse warms the import dialog's chunk here, before an action is chosen.
  it('tells onMenuOpen each time the menu opens, by press or by key, and not when it closes', () => {
    const onMenuOpen = vi.fn();
    renderActions(false, onMenuOpen);
    fireEvent.click(gear());
    expect(onMenuOpen).toHaveBeenCalledOnce();
    fireEvent.click(gear());
    expect(onMenuOpen).toHaveBeenCalledOnce();
    fireEvent.keyDown(gear(), {key: 'ArrowDown'});
    expect(onMenuOpen).toHaveBeenCalledTimes(2);
  });
});
