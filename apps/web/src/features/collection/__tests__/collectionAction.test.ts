import {describe, it, expect} from 'vitest';
import {collectionAction} from '../collectionAction';

describe('collectionAction', () => {
  it('asks a signed-out visitor to sign in', () => {
    expect(collectionAction({signedIn: false, hasCollection: false, syncing: false})).toBe('sign-in');
  });

  it('asks a signed-in user with no collection to import one', () => {
    expect(collectionAction({signedIn: true, hasCollection: false, syncing: false})).toBe('import');
  });

  it('waits for the account copy before offering an import, while the sync has not answered', () => {
    // A collection that lives only on the server reads as none until then.
    expect(collectionAction({signedIn: true, hasCollection: false, syncing: true})).toBe('wait');
  });

  it('toggles the pool once both are in place, sync answered or not', () => {
    expect(collectionAction({signedIn: true, hasCollection: true, syncing: false})).toBe('toggle');
    expect(collectionAction({signedIn: true, hasCollection: true, syncing: true})).toBe('toggle');
  });

  it('still asks a signed-out visitor to sign in when a local collection exists', () => {
    // The case that cannot be reached by clicking through in order, and so the
    // one worth pinning: collections predate the sign-in gate, so a returning
    // visitor can hold one in localStorage while signed out. Sign-in wins —
    // letting the stored copy through would make the gate decorative.
    expect(collectionAction({signedIn: false, hasCollection: true, syncing: false})).toBe('sign-in');
  });
});
