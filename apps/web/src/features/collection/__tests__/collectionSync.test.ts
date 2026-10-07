import {describe, it, expect} from 'vitest';
import {belongsTo, resolveCollectionSync, visibleTo, type SyncInput} from '../collectionSync';

const UID = 'user-a';

/** A local import this uid made, never uploaded, no server row, no markers. */
function input(overrides: Partial<SyncInput> = {}): SyncInput {
  return {
    uid: UID,
    local: {importedAt: 1000, ownerUid: UID, source: 'import'},
    hasServer: false,
    migratedImportedAt: null,
    pendingImportedAt: null,
    ...overrides,
  };
}

describe('resolveCollectionSync', () => {
  it('adopts the server copy when one exists', () => {
    expect(resolveCollectionSync(input({local: null, hasServer: true}))).toBe('adopt-server');
  });

  it('uploads a local collection when the server has none', () => {
    expect(resolveCollectionSync(input())).toBe('upload');
  });

  it('lets the server win when both exist', () => {
    // Owner ruling 2026-08-11. A collection is ONE row, so uploading over an
    // existing one destroys a remote import with no undo.
    expect(resolveCollectionSync(input({hasServer: true}))).toBe('adopt-server');
  });

  it('does nothing when there is nothing anywhere', () => {
    expect(resolveCollectionSync(input({local: null}))).toBe('none');
  });

  describe('the resurrection guard (migrated marker)', () => {
    it('does not re-upload the copy that already migrated', () => {
      // After migrating, the user clears their collection from another device: the
      // row is gone, but sign-out kept this browser's copy. Re-uploading it would
      // undo their deletion.
      expect(resolveCollectionSync(input({migratedImportedAt: 1000}))).toBe('none');
    });

    it('uploads a NEW import made after migrating (#739 defect 3)', () => {
      expect(resolveCollectionSync(input({migratedImportedAt: 900}))).toBe('upload');
    });
  });

  describe('ownership (#739 defect 1)', () => {
    it('uploads an anonymous import on sign-in, the case the branch exists for', () => {
      expect(resolveCollectionSync(input({local: {importedAt: 1000, ownerUid: null, source: 'import'}}))).toBe(
        'upload',
      );
    });

    it("never uploads another account's copy", () => {
      expect(
        resolveCollectionSync(input({local: {importedAt: 1000, ownerUid: 'user-b', source: 'import'}})),
      ).toBe('none');
    });
  });

  describe('provenance (#739 defect 6)', () => {
    it('never uploads a copy that came from the server, even with no marker', () => {
      // The marker write failed after a successful mirror, then the row was
      // deleted elsewhere. The same vector with `source: 'import'` uploads.
      expect(resolveCollectionSync(input({local: {importedAt: 1000, ownerUid: UID, source: 'server'}}))).toBe(
        'none',
      );
    });
  });

  describe('a pending upload (#739 defect 2)', () => {
    it('uploads over the server row when this copy was never confirmed', () => {
      expect(resolveCollectionSync(input({hasServer: true, pendingImportedAt: 1000}))).toBe('upload');
    });

    it('still lets the server win when the pending marker names a different copy', () => {
      expect(resolveCollectionSync(input({hasServer: true, pendingImportedAt: 900}))).toBe('adopt-server');
    });

    it('uploads a pending copy whose marker would otherwise read as migrated', () => {
      // No row, and the migrated marker already names this copy: only the
      // pending marker says the server never actually confirmed it.
      expect(resolveCollectionSync(input({pendingImportedAt: 1000, migratedImportedAt: 1000}))).toBe('upload');
    });

    it('ignores a pending marker once the copy is the server one', () => {
      // A confirmed upload re-stamps the copy; a pending marker that then failed to
      // clear must not push it over the server on every sync.
      const local = {importedAt: 1000, ownerUid: UID, source: 'server' as const};
      expect(resolveCollectionSync(input({local, hasServer: true, pendingImportedAt: 1000}))).toBe(
        'adopt-server',
      );
    });

    it("does not let a pending marker push another account's copy", () => {
      const local = {importedAt: 1000, ownerUid: 'user-b', source: 'import' as const};
      expect(resolveCollectionSync(input({local, hasServer: true, pendingImportedAt: 1000}))).toBe(
        'adopt-server',
      );
    });
  });
});

describe('belongsTo / visibleTo', () => {
  const owned = {ownerUid: 'user-a'};
  const anonymous = {ownerUid: null};

  it('an anonymous copy belongs to whoever signs in', () => {
    expect(belongsTo(anonymous, 'user-b')).toBe(true);
  });

  it("hides another account's copy from a signed-in user (owner ruling 2026-10-06)", () => {
    expect(visibleTo(owned, {uid: 'user-b', loading: false})).toBe(false);
  });

  it('shows a copy to its owner and while signed out', () => {
    expect(visibleTo(owned, {uid: 'user-a', loading: false})).toBe(true);
    expect(visibleTo(owned, {uid: null, loading: false})).toBe(true);
  });

  it('hides an owned copy while the session is still resolving', () => {
    // On reload the uid is null until the lookup lands, so "signed out" here may
    // be account B a moment from now.
    expect(visibleTo(owned, {uid: null, loading: true})).toBe(false);
    expect(visibleTo(anonymous, {uid: null, loading: true})).toBe(true);
  });
});
