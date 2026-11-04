import {describe, it, expect, vi} from 'vitest';
import {renderHook} from '@testing-library/react';
import type {Binder} from './binderRules';
import type {BinderShelf} from './binderShelf';
import {useShelf, type ShelfAsk} from './useShelf';

const AMBER: Binder = {id: 'b1', name: 'Amber', scope: 'all', rules: 'ink=Amber', coverId: null, place: 0};
const shelfOf = (status: BinderShelf['status'], binders: Binder[] = []): BinderShelf => ({status, binders, retry: () => {}});

/** On the shelf, the account answered, a copy held, two binders read. */
const ON: ShelfAsk = {on: true, syncing: false, holdsCopies: true, shelf: shelfOf('ready', [AMBER, {...AMBER, id: 'b2', place: 1}])};

function renderShelf(ask: ShelfAsk) {
  const toBinder = vi.fn();
  const {result} = renderHook(() => useShelf(ask, toBinder));
  return {slot: result.current, toBinder};
}

describe('useShelf', () => {
  it('is no slot off the shelf', () => {
    const {slot, toBinder} = renderShelf({...ON, on: false, holdsCopies: false, shelf: shelfOf('ready')});
    expect(slot).toBeNull();
    expect(toBinder).not.toHaveBeenCalled();
  });

  it('counts the binders, My collection included, once they have read', () => {
    expect(renderShelf(ON).slot).toEqual({count: 3});
  });

  it('waits for the account and the binders, counting nothing and swapping nothing', () => {
    for (const ask of [
      {...ON, syncing: true, holdsCopies: false, shelf: shelfOf('ready')},
      {...ON, holdsCopies: false, shelf: shelfOf('loading')},
      {...ON, holdsCopies: false, shelf: shelfOf('idle')},
    ]) {
      const {slot, toBinder} = renderShelf(ask);
      expect(slot).toEqual({count: null});
      expect(toBinder).not.toHaveBeenCalled();
    }
  });

  it('gives a player with no copy and no binder the empty start in its place, a failed read counting as none', () => {
    for (const shelf of [shelfOf('ready'), shelfOf('failed')]) {
      expect(renderShelf({...ON, holdsCopies: false, shelf}).toBinder).toHaveBeenCalledOnce();
    }
  });

  it('keeps the shelf for a binder and no copy, and for copies and no binder', () => {
    expect(renderShelf({...ON, holdsCopies: false, shelf: shelfOf('ready', [AMBER])}).toBinder).not.toHaveBeenCalled();
    const copies = renderShelf({...ON, shelf: shelfOf('ready')});
    expect(copies.toBinder).not.toHaveBeenCalled();
    expect(copies.slot).toEqual({count: 1});
  });
});
