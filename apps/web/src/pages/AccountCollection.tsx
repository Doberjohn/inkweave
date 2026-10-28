import {Suspense, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {useCollection} from '../features/collection/CollectionContext';
import {useCollectionCards, useCollectionPool} from '../features/collection/CollectionCardsContext';
import {SharingSwitch} from '../features/collection/SharingSwitch';
import {useCollectionSharing} from '../features/collection/useCollectionSharing';
import {SHOW_FRIENDS} from '../features/friends/flag';
import {useCardDataContext} from '../shared/contexts/CardDataContext';
import {trackEvent} from '../shared/lib/analytics';
import {lazyWithRetry} from '../shared/lib/lazyWithRetry';
import {CollectionSection} from './AccountPage';

/**
 * The import dialog, split out so the CSV parser behind it loads only when opened, and
 * through `lazyWithRetry`, so a stale chunk after a deploy retries rather than failing.
 */
const ImportCollectionDialog = lazyWithRetry(
  () => import('../features/collection/ImportCollectionDialog'),
  'ImportCollectionDialog',
);

/**
 * The account page's collection section and its import (#553 Phase C), wired to the
 * collection. A module of its own, which the page loads only under `SHOW_COLLECTION`:
 * its hooks need the collection providers, which mount only under that flag, and a
 * static import of them put the collection's data layer on /account for everyone, flag
 * off (`flag.ts`: off means NOT LOADED). The section itself is the page's
 * `CollectionSection`.
 */
export function AccountCollection() {
  const {cards} = useCardDataContext();
  const {hasCollection, holdsCopies, syncing, importCollection, startCollection, clearImported, ownedCount, entries, importedAt} =
    useCollection();
  const navigate = useNavigate();
  const [showImport, setShowImport] = useState(false);
  // Mounted from first open on, so closing plays the dialog's exit animation.
  const [importMounted, setImportMounted] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  // Widened only while the import is open, so opening /account fetches nothing.
  const {pool, error, isReady} = useCollectionPool(cards, showImport);
  const {retry} = useCollectionCards();
  const owned = Object.keys(entries).filter((id) => ownedCount(id) > 0).length;
  // Friends see a collection only through this switch, so it shows only with friends on.
  const sharing = useCollectionSharing(SHOW_FRIENDS);

  return (
    <>
      <CollectionSection
        hasCollection={hasCollection}
        checking={syncing && !hasCollection}
        owned={owned}
        importedAt={importedAt}
        confirming={confirmClear}
        onImport={() => {
          setImportMounted(true);
          setShowImport(true);
        }}
        // The whole collection, as Browse's Collection button opens it; the binder waits there
        // while the start reads the account.
        onOpenBinder={() => {
          startCollection('account');
          navigate('/browse?binder=all');
        }}
        onAskClear={() => setConfirmClear(true)}
        onConfirmClear={() => {
          trackEvent('collection_deleted', {cards: owned});
          clearImported();
          setConfirmClear(false);
        }}
        onCancelClear={() => setConfirmClear(false)}
        sharing={SHOW_FRIENDS && <SharingSwitch sharing={sharing} />}
        sharingOn={sharing.on}
      />
      {importMounted && (
        <Suspense fallback={null}>
          <ImportCollectionDialog
            isOpen={showImport}
            onClose={() => setShowImport(false)}
            pool={pool}
            // The import must wait for the full pool; a Core-only parse silently
            // drops two thirds of a real collection.
            isPoolReady={isReady}
            poolError={error}
            onRetryPool={retry}
            onImport={importCollection}
            context={{surface: 'account', replacing: holdsCopies}}
          />
        </Suspense>
      )}
    </>
  );
}
