import {useEffect, useState} from 'react';
import {useSession} from '../../shared/contexts/SessionContext';
import {trackEvent} from '../../shared/lib/analytics';
import {useCollection} from './CollectionContext';
import {enqueueWrite} from './collectionWriteQueue';
import {getSharing, setSharing} from './sharingRepository';

/** The switch on /account that lets the player's friends see their collection. */
export interface CollectionSharing {
  status: 'loading' | 'ready' | 'failed';
  /** As shown: a write in flight shows its new value at once. */
  on: boolean;
  /** A write is in flight. */
  busy: boolean;
  /** The last write failed, and the switch went back. */
  writeFailed: boolean;
  set: (on: boolean) => void;
  retry: () => void;
}

/** What the read answered for one player, or that it failed. */
type Read = {ownerId: string; value: boolean | 'failed'};

/**
 * The player's switch. Read once the account holds a collection and its copy has answered
 * (`syncing`), since the switch's row hangs off the collection's. Clearing the collection
 * removes the row, so the switch reads off with no read, and a new import reads it again
 * (a new collection starts with none). Its read and write wait in the collection's write
 * queue, behind an import's upload or a clear's delete. `enabled` false reads nothing, for
 * a page whose friends are off.
 */
export function useCollectionSharing(enabled: boolean): CollectionSharing {
  const {user} = useSession();
  const ownerId = ownerOf(enabled, useCollection(), user);
  const {answer, settle, retry} = useSharingRead(ownerId);
  const status = statusOf(ownerId, answer);
  const {pending, writeFailed, write} = useSharingWrite(ownerId, settle);

  return {
    status,
    on: pending ?? answer === true,
    busy: pending !== null,
    writeFailed,
    set: (next) => {
      if (status === 'ready') write(next);
    },
    retry,
  };
}

/** Whose switch to read: the signed-in player's, once their collection's copy has answered. */
function ownerOf(enabled: boolean, collection: {hasCollection: boolean; syncing: boolean}, user: {id: string} | null): string | null {
  if (!enabled || user === null) return null;
  return collection.hasCollection && !collection.syncing ? user.id : null;
}

function statusOf(ownerId: string | null, answer: Read['value'] | null): CollectionSharing['status'] {
  if (ownerId === null) return 'ready';
  if (answer === null) return 'loading';
  return answer === 'failed' ? 'failed' : 'ready';
}

/** The switch as saved for `ownerId`: null until its read lands; `settle` records a write that did. */
function useSharingRead(ownerId: string | null) {
  const [read, setRead] = useState<Read | null>(null);
  const [attempt, setAttempt] = useState(0);

  // No collection (cleared, or signed out): forget the last answer, so the next collection's
  // switch shows loading until its own read lands, never the cleared one's.
  if (ownerId === null && read !== null) setRead(null);

  useEffect(() => {
    if (ownerId === null) return;
    let live = true;
    void readSharing(ownerId).then((value) => {
      if (live) setRead({ownerId, value});
    });
    return () => {
      live = false;
    };
  }, [ownerId, attempt]);

  return {
    answer: read?.ownerId === ownerId ? read.value : null,
    settle: (value: boolean) => {
      if (ownerId !== null) setRead({ownerId, value});
    },
    retry: () => {
      setRead(null);
      setAttempt((n) => n + 1);
    },
  };
}

/** One write at a time: the value in flight, and whether the last one failed. */
function useSharingWrite(ownerId: string | null, onSaved: (value: boolean) => void) {
  const [pending, setPending] = useState<boolean | null>(null);
  const [writeFailed, setWriteFailed] = useState(false);

  const write = (next: boolean) => {
    if (ownerId === null || pending !== null) return;
    setPending(next);
    setWriteFailed(false);
    void writeSharing(ownerId, next).then((saved) => {
      if (saved) onSaved(next);
      else setWriteFailed(true);
      setPending(null);
    });
  };

  return {pending, writeFailed, write};
}

async function readSharing(ownerId: string): Promise<Read['value']> {
  const {data, error} = await enqueueWrite(ownerId, () => getSharing(ownerId));
  return error === null ? data === true : 'failed';
}

/** Whether the write landed; one that did is the analytics event. */
async function writeSharing(ownerId: string, next: boolean): Promise<boolean> {
  const {error} = await enqueueWrite(ownerId, () => setSharing(ownerId, next));
  if (error !== null) return false;
  trackEvent('collection_sharing_changed', {state: next ? 'on' : 'off'});
  return true;
}
