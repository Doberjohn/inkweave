import {describe, it, expect, vi} from 'vitest';
import {collectionAction, collectionClick, type ClickState} from '../collectionAction';

describe('collectionAction', () => {
  it('asks a signed-out visitor to sign in', () => {
    expect(collectionAction({signedIn: false, hasCollection: false})).toBe('sign-in');
  });

  it('starts a collection for a signed-in user with none', () => {
    expect(collectionAction({signedIn: true, hasCollection: false})).toBe('start');
  });

  it('toggles the binder once both are in place', () => {
    expect(collectionAction({signedIn: true, hasCollection: true})).toBe('toggle');
  });

  it('still asks a signed-out visitor to sign in when a local collection exists', () => {
    // The case that cannot be reached by clicking through in order, and so the
    // one worth pinning: collections predate the sign-in gate, so a returning
    // visitor can hold one in localStorage while signed out. Sign-in wins —
    // letting the stored copy through would make the gate decorative.
    expect(collectionAction({signedIn: false, hasCollection: true})).toBe('sign-in');
  });
});

describe('collectionClick', () => {
  /** Signed in with nothing in this browser, the binder closed. */
  const NONE: ClickState = {signedIn: true, hasCollection: false, active: false};
  const click = (state: ClickState) => {
    const acts = {openSignIn: vi.fn(), start: vi.fn(), enter: vi.fn(), leave: vi.fn()};
    collectionClick(state, acts);
    return acts;
  };

  it('starts a collection and opens the binder for a reader with none', () => {
    const acts = click(NONE);
    expect(acts.start).toHaveBeenCalledOnce();
    expect(acts.enter).toHaveBeenCalledOnce();
  });

  it('opens the binder of a reader with a collection, starting nothing', () => {
    const acts = click({...NONE, hasCollection: true});
    expect(acts.enter).toHaveBeenCalledOnce();
    expect(acts.start).not.toHaveBeenCalled();
  });

  it('closes a binder that is open, collection or not', () => {
    for (const hasCollection of [true, false]) {
      const acts = click({...NONE, hasCollection, active: true});
      expect(acts.leave).toHaveBeenCalledOnce();
      expect(acts.start).not.toHaveBeenCalled();
      expect(acts.enter).not.toHaveBeenCalled();
    }
  });

  it('asks a signed-out visitor to sign in, and starts nothing', () => {
    const acts = click({...NONE, signedIn: false});
    expect(acts.openSignIn).toHaveBeenCalledOnce();
    expect(acts.start).not.toHaveBeenCalled();
    expect(acts.enter).not.toHaveBeenCalled();
  });
});
