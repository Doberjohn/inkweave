import {Suspense, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {BINDER_PARAM, WHOLE_COLLECTION} from '../features/collection/binderCards';
import {useCollection} from '../features/collection/CollectionContext';
import {useCollectionCards, useCollectionPool} from '../features/collection/CollectionCardsContext';
import {SharingSwitch} from '../features/collection/SharingSwitch';
import {useCollectionSharing} from '../features/collection/useCollectionSharing';
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
 * collection. A module of its own, which the page loads lazily, so the collection's data
 * layer stays out of the account route's chunk. The section itself is the page's
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
  // Friends see a collection only through this switch.
  const sharing = useCollectionSharing();

  return (
    <>
      <CollectionSection
        hasCollection={hasCollection}
        checking={syncing && !hasCollection}
        owned={owned}
        importedAt={importedAt}
        confirming={confirmClear}
        onImport={() => {
          trackEvent('collection_import_opened', {surface: 'account', replacing: holdsCopies});
          setImportMounted(true);
          setShowImport(true);
        }}
        // The whole collection, as Browse's Collection button opens it; the binder waits there
        // while the start reads the account.
        onOpenBinder={() => {
          startCollection('account');
          navigate(`/browse?${BINDER_PARAM}=${WHOLE_COLLECTION}`);
        }}
        onAskClear={() => setConfirmClear(true)}
        onConfirmClear={() => {
          trackEvent('collection_deleted', {cards: owned});
          clearImported();
          setConfirmClear(false);
        }}
        onCancelClear={() => setConfirmClear(false)}
        sharing={<SharingSwitch sharing={sharing} />}
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
