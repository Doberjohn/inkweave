import {describe, it, expect, vi} from 'vitest';
import {fireEvent, render, screen} from '@testing-library/react';
import {BinderMenu} from './BinderMenu';

function renderMenu(place: {first?: boolean; last?: boolean; onEditRules?: () => void} = {}) {
  const acts = {onOpen: vi.fn(), onMove: vi.fn(), onDelete: vi.fn()};
  render(
    <BinderMenu
      moves={{first: place.first ?? false, last: place.last ?? false, onMove: acts.onMove}}
      alwaysShown={false}
      onEditRules={place.onEditRules}
      onOpen={acts.onOpen}
      onDelete={acts.onDelete}
    />,
  );
  return acts;
}

const dots = () => screen.getByRole('button', {name: 'Actions'});
const items = () => screen.getAllByRole('menuitem').map((item) => item.textContent);

describe('BinderMenu', () => {
  it('offers every action on a binder in the middle of the shelf, Open first and focused', () => {
    renderMenu();
    fireEvent.click(dots());
    expect(items()).toEqual(['Open', 'Move earlier', 'Move later', 'Delete binder']);
    expect(screen.getByRole('menuitem', {name: 'Open'})).toHaveFocus();
  });

  it('offers Edit rules after Open when the window can open, closing the menu onto ⋯ first', () => {
    const onEditRules = vi.fn();
    renderMenu({onEditRules});
    fireEvent.click(dots());
    expect(items()).toEqual(['Open', 'Edit rules', 'Move earlier', 'Move later', 'Delete binder']);
    fireEvent.click(screen.getByRole('menuitem', {name: 'Edit rules'}));
    expect(onEditRules).toHaveBeenCalledOnce();
    expect(screen.queryByRole('menu')).toBeNull();
    expect(dots()).toHaveFocus();
  });

  it('offers Rename and Change cover after Edit rules, in the order the menu keeps', () => {
    const onRename = vi.fn();
    const onChangeCover = vi.fn();
    render(
      <BinderMenu
        alwaysShown={false}
        onOpen={vi.fn()}
        onEditRules={vi.fn()}
        onRename={onRename}
        onChangeCover={onChangeCover}
        moves={{first: false, last: false, onMove: vi.fn()}}
        onDelete={vi.fn()}
      />,
    );
    fireEvent.click(dots());
    expect(items()).toEqual(['Open', 'Edit rules', 'Rename', 'Change cover', 'Move earlier', 'Move later', 'Delete binder']);
    fireEvent.click(screen.getByRole('menuitem', {name: 'Rename'}));
    expect(onRename).toHaveBeenCalledOnce();
    fireEvent.click(dots());
    fireEvent.click(screen.getByRole('menuitem', {name: 'Change cover'}));
    expect(onChangeCover).toHaveBeenCalledOnce();
    expect(dots()).toHaveFocus();
  });

  it("offers My collection's Open, Change cover and Change page size alone: it never moves and can't be deleted", () => {
    const onChangePages = vi.fn();
    render(<BinderMenu alwaysShown={false} onOpen={vi.fn()} onChangeCover={vi.fn()} onChangePages={onChangePages} />);
    fireEvent.click(dots());
    expect(items()).toEqual(['Open', 'Change cover', 'Change page size']);
    fireEvent.click(screen.getByRole('menuitem', {name: 'Change page size'}));
    expect(onChangePages).toHaveBeenCalledOnce();
    expect(dots()).toHaveFocus();
  });

  it('has no Move earlier on the first binder and no Move later on the last', () => {
    renderMenu({first: true});
    fireEvent.click(dots());
    expect(items()).toEqual(['Open', 'Move later', 'Delete binder']);
    fireEvent.click(dots());

    renderMenu({last: true});
    fireEvent.click(screen.getAllByRole('button', {name: 'Actions'})[1]);
    expect(items()).toEqual(['Open', 'Move earlier', 'Delete binder']);
  });

  it('closes onto ⋯ when ⋯ is pressed again, where a click focuses no button', () => {
    renderMenu();
    fireEvent.click(dots());
    expect(screen.getByRole('menuitem', {name: 'Open'})).toHaveFocus();
    fireEvent.click(dots());
    expect(screen.queryByRole('menu')).toBeNull();
    expect(dots()).toHaveFocus();
  });

  it('gives ⋯ the 44 px touch target round its smaller disc', () => {
    renderMenu();
    expect(dots()).toHaveStyle({width: '44px', height: '44px'});
  });

  it('moves the binder, closing the menu onto ⋯ first', () => {
    const acts = renderMenu();
    fireEvent.click(dots());
    fireEvent.click(screen.getByRole('menuitem', {name: 'Move later'}));
    expect(acts.onMove).toHaveBeenCalledWith(false);
    expect(screen.queryByRole('menu')).toBeNull();
    expect(dots()).toHaveFocus();
  });

  it('asks before deleting: Delete binder only opens the confirm', () => {
    const acts = renderMenu();
    fireEvent.click(dots());
    fireEvent.click(screen.getByRole('menuitem', {name: 'Delete binder'}));
    expect(acts.onDelete).toHaveBeenCalledOnce();
    expect(acts.onMove).not.toHaveBeenCalled();
  });

  it('closes on Escape, back onto ⋯', () => {
    renderMenu();
    fireEvent.keyDown(dots(), {key: 'ArrowDown'});
    fireEvent.keyDown(screen.getByRole('menuitem', {name: 'Open'}), {key: 'Escape'});
    expect(screen.queryByRole('menu')).toBeNull();
    expect(dots()).toHaveFocus();
  });
});
