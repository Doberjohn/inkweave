import {describe, it, expect} from 'vitest';
import {resolveCollectionSync} from '../collectionSync';

describe('resolveCollectionSync', () => {
  it('adopts the server copy when one exists', () => {
    expect(resolveCollectionSync({hasLocal: false, hasServer: true, alreadyMigrated: false})).toBe(
      'adopt-server',
    );
  });

  it('uploads a local collection when the server has none', () => {
    expect(resolveCollectionSync({hasLocal: true, hasServer: false, alreadyMigrated: false})).toBe(
      'upload',
    );
  });

  it('lets the server win when both exist', () => {
    // Owner ruling 2026-08-11. A collection is ONE row, so uploading over an
    // existing one destroys a remote import with no undo. The local copy is
    // always re-creatable from the CSV; the remote one may not be.
    expect(resolveCollectionSync({hasLocal: true, hasServer: true, alreadyMigrated: false})).toBe(
      'adopt-server',
    );
  });

  it('does not re-upload a local collection that already migrated', () => {
    // THE RESURRECTION GUARD, and the reason this is not just `hasServer`.
    // After migrating, the user may clear their collection from another device:
    // the server row is gone, but this browser still holds the local copy
    // (sign-out deliberately keeps it). Re-uploading would undo their deletion.
    //
    // THIS CASE ALSO PINS A DEFECT, said out loud so the next reader does not
    // take the green tick as approval. A NEW import made while signed out is
    // indistinguishable here from the stale copy the guard exists for: both are
    // `hasLocal: true, alreadyMigrated: true`, so the new import is never
    // uploaded either. Three booleans cannot tell them apart. Tracked
    // by #739.
    expect(resolveCollectionSync({hasLocal: true, hasServer: false, alreadyMigrated: true})).toBe(
      'none',
    );
  });

  it('does nothing when there is nothing anywhere', () => {
    expect(resolveCollectionSync({hasLocal: false, hasServer: false, alreadyMigrated: false})).toBe(
      'none',
    );
  });

  it('still adopts the server copy after migrating', () => {
    // The marker gates UPLOADS, not reads: a signed-in user must pick up their
    // collection on every load, not only the first.
    //
    // AND THIS ONE PINS THE OTHER. Correct for the conflict it was written for,
    // but it is also what makes a failed upsert lose data: an import whose cloud
    // write failed leaves the older server row in place, and the next mount
    // lands here and adopts it over the newer local copy. Same issue.
    expect(resolveCollectionSync({hasLocal: true, hasServer: true, alreadyMigrated: true})).toBe(
      'adopt-server',
    );
  });
});
