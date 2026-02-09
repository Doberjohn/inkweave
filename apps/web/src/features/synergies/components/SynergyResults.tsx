import type {LorcanaCard} from '../../cards';
import type {GroupedSynergies} from '../types';
import {CardDetail, SynergyGroup} from '.';
import {EmptyState} from '../../../shared/components';
import {COLORS, FONT_SIZES, SPACING, LAYOUT} from '../../../shared/constants';

interface SynergyResultsProps {
  selectedCard: LorcanaCard | null;
  synergies: GroupedSynergies[];
  totalSynergyCount: number;
  onClearSelection: () => void;
  isMobile?: boolean;
  /** When false, CardDetail is rendered externally (e.g. CardDetailPanel). Default: true for mobile. */
  showCardDetail?: boolean;
}

export function SynergyResults({
  selectedCard,
  synergies,
  totalSynergyCount,
  onClearSelection,
  isMobile = false,
  showCardDetail,
}: SynergyResultsProps) {
  // Default: show card detail on mobile, hide on desktop (it's in its own panel)
  const renderCardDetail = showCardDetail ?? isMobile;

  return (
    <div
      style={{
        flex: 1,
        padding: isMobile ? `${SPACING.md}px` : `${SPACING.xl}px`,
        overflowY: 'auto',
        maxHeight: isMobile ? '100vh' : `calc(100vh - ${LAYOUT.compactHeaderHeight}px)`,
        background: isMobile ? COLORS.background : undefined,
      }}>
      {!selectedCard ? (
        <EmptyState
          title="Select a card to see synergies"
          subtitle='Try "Elsa" or filter by Amethyst'
        />
      ) : (
        <>
          {renderCardDetail && (
            <CardDetail card={selectedCard} onClear={onClearSelection} />
          )}

          {synergies.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: `${SPACING.xxl * 2}px`,
                color: COLORS.gray400,
              }}>
              <p>No synergies found for this card.</p>
              <p style={{fontSize: `${FONT_SIZES.base}px`, marginTop: `${SPACING.sm}px`}}>
                Try a card with Singer, Shift, Evasive, or Bodyguard.
              </p>
            </div>
          ) : (
            <>
              <div style={{marginBottom: `${SPACING.lg}px`}}>
                <span style={{fontSize: `${FONT_SIZES.lg}px`, color: COLORS.gray500}}>
                  Found <strong style={{color: COLORS.primary600}}>{totalSynergyCount}</strong>{' '}
                  synergistic cards
                </span>
              </div>
              {synergies.map((group) => (
                <SynergyGroup key={group.type} group={group} />
              ))}
            </>
          )}
        </>
      )}
    </div>
  );
}
