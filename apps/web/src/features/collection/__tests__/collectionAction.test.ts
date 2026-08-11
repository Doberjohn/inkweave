import {describe, it, expect} from 'vitest';
import {collectionAction} from '../collectionAction';

describe('collectionAction', () => {
  it('asks a signed-out visitor to sign in', () => {
    expect(collectionAction({signedIn: false, hasCollection: false})).toBe('sign-in');
  });

  it('asks a signed-in user with no collection to import one', () => {
    expect(collectionAction({signedIn: true, hasCollection: false})).toBe('import');
  });

  it('toggles the pool once both are in place', () => {
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
