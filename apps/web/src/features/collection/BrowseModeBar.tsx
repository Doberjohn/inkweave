import type {LorcanaCard} from '../deck/types';
import {useCollection} from './CollectionContext';
import {ImportCollectionDialog} from './ImportCollectionDialog';
import {CtaButton, TabList} from '../../shared/components';
import {COLORS, FONT_SIZES, SPACING} from '../../shared/constants';

/**
 * Browse's mode row: All cards / My collection, plus the import entry point.
 *
 * THE IMPORT LIVES HERE because until now it lived nowhere. `ImportCollectionDialog`
 * shipped in Phase 2 with no mount site anywhere in the app, so `hasCollection` was
 * false for everyone and the feature was unreachable. Browse is the right home: it
 * is the only screen whose behaviour changes once you have a collection.
 */

const MODES = [
  {id: 'all' as const, label: 'All cards'},
  {id: 'collection' as const, label: 'My collection'},
];

export type BrowseMode = (typeof MODES)[number]['id'];

interface BrowseModeBarProps {
  mode: BrowseMode;
  onModeChange: (mode: BrowseMode) => void;
  /**
   * The pool the CSV is joined against. Browse passes the MERGED pool, which is
   * what lets a Dreamborn export resolve its non-Core rows — the same parser
   * against the Core-only pool counts them and throws them away.
   */
  pool: readonly LorcanaCard[];
  /** False while the non-Core chunks are still in flight; blocks a partial parse. */
  isPoolReady: boolean;
  isImportOpen: boolean;
  onImportOpen: () => void;
  onImportClose: () => void;
}

export function BrowseModeBar({
  mode,
  onModeChange,
  pool,
  isPoolReady,
  isImportOpen,
  onImportOpen,
  onImportClose,
}: BrowseModeBarProps) {
  const {hasCollection, importCollection, ownedCount, entries} = useCollection();
  const distinct = Object.keys(entries).filter((id) => ownedCount(id) > 0).length;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: SPACING.lg,
        padding: `0 ${SPACING.xxl}px ${SPACING.sm}px`,
        flexWrap: 'wrap',
      }}>
      {/* The switch is pointless with nothing to switch to, so it appears only
          once there is a collection. Before that the import IS the affordance. */}
      {hasCollection && (
        <div style={{minWidth: 260}}>
          <TabList tabs={MODES} active={mode} onChange={onModeChange} ariaLabel="Browse mode" />
        </div>
      )}

      <CtaButton variant={hasCollection ? 'neutral' : 'filled'} onClick={onImportOpen}>
        {hasCollection ? 'Re-import collection' : 'Import collection'}
      </CtaButton>

      {hasCollection && (
        <span style={{color: COLORS.textMuted, fontSize: `${FONT_SIZES.sm}px`}}>
          {`${distinct.toLocaleString()} cards owned`}
        </span>
      )}

      <ImportCollectionDialog
        isOpen={isImportOpen}
        onClose={onImportClose}
        pool={pool}
        isPoolReady={isPoolReady}
        onImport={importCollection}
      />
    </div>
  );
}
