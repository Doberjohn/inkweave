import {CompactHeader, ErrorBoundary, EtherealBackground} from '../shared/components';

/**
 * Set 12 Reveals page. Stub pending Pencil design — see issue #278.
 *
 * When implementing the final UI:
 * - `useCardDataContext()` provides the card pool (already merges previewCards.json)
 * - Filter preview cards with `cards.filter(c => c.setCode === '12')`
 * - Use `useManifest()` + `hasSynergies(card.id)` to decide which tiles are clickable
 * - Use `FRANCHISES` + `matchesFranchise(card, activeFranchise)` for IP filtering
 */
export function RevealsPage() {
  return (
    <ErrorBoundary>
      <EtherealBackground />
      <CompactHeader />
      <main style={{minHeight: '100vh', paddingTop: 80}} />
    </ErrorBoundary>
  );
}
