import {describe, it, expect, vi} from 'vitest';
import {act, renderHook} from '@testing-library/react';
import {useCollectionClick, type ClickState} from '../useCollectionClick';

function setup(initial: ClickState) {
  const acts = {openSignIn: vi.fn(), openImport: vi.fn(), enter: vi.fn(), leave: vi.fn()};
  const hook = renderHook((state: ClickState) => useCollectionClick(state, acts), {initialProps: initial});
  return {acts, ...hook};
}

/** Signed in on a new browser: nothing stored here, and the account has not answered. */
const NEW_BROWSER: ClickState = {signedIn: true, hasCollection: false, syncing: true, active: false};

describe('useCollectionClick', () => {
  it('opens the binder at once while the account has not answered, then offers the import if none came', () => {
    const {acts, result, rerender} = setup(NEW_BROWSER);
    act(() => result.current());
    expect(acts.enter).toHaveBeenCalledTimes(1);
    expect(acts.openImport).not.toHaveBeenCalled();

    rerender({...NEW_BROWSER, syncing: false});
    expect(acts.openImport).toHaveBeenCalledTimes(1);
  });

  it('keeps the binder it opened when the account answers with a collection', () => {
    const {acts, result, rerender} = setup(NEW_BROWSER);
    act(() => result.current());
    rerender({...NEW_BROWSER, syncing: false, hasCollection: true, active: true});
    expect(acts.openImport).not.toHaveBeenCalled();
  });

  it('drops the wait when the binder is closed before the account answers', () => {
    const {acts, result, rerender} = setup(NEW_BROWSER);
    act(() => result.current());
    rerender({...NEW_BROWSER, active: true});
    act(() => result.current());
    rerender({...NEW_BROWSER, syncing: false});
    expect(acts.openImport).not.toHaveBeenCalled();
  });

  it('never offers the import to a visitor who signed out while it waited', () => {
    const {acts, result, rerender} = setup(NEW_BROWSER);
    act(() => result.current());
    rerender({...NEW_BROWSER, signedIn: false, syncing: false});
    expect(acts.openImport).not.toHaveBeenCalled();
  });

  it('closes a binder that is open rather than waiting on the account', () => {
    const {acts, result} = setup({...NEW_BROWSER, active: true});
    act(() => result.current());
    expect(acts.leave).toHaveBeenCalledTimes(1);
    expect(acts.enter).not.toHaveBeenCalled();
  });

  it('offers the import at once when the account has answered with none', () => {
    const {acts, result} = setup({...NEW_BROWSER, syncing: false});
    act(() => result.current());
    expect(acts.openImport).toHaveBeenCalledTimes(1);
    expect(acts.enter).not.toHaveBeenCalled();
  });

  it('asks a signed-out visitor to sign in', () => {
    const {acts, result} = setup({...NEW_BROWSER, signedIn: false, syncing: false});
    act(() => result.current());
    expect(acts.openSignIn).toHaveBeenCalledTimes(1);
  });
});
