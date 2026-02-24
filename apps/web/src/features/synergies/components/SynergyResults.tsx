import {memo} from 'react';
import type {LorcanaCard} from '../../cards';
import type {GroupedSynergies} from '../types';
import {CardDetail, SynergyGroup} from '.';
import {EmptyState} from '../../../shared/components';
import {COLORS, FONT_SIZES, SPACING, RADIUS, LAYOUT} from '../../../shared/constants';

interface SynergyResultsProps {
  selectedCard: LorcanaCard | null;
  synergies: GroupedSynergies[];
  totalSynergyCount: number;
  onClearSelection: () => void;
  isMobile?: boolean;
  /** When false, CardDetail is rendered externally (e.g. CardDetailPanel). Default: true for mobile. */
  showCardDetail?: boolean;
}

export const SynergyResults = memo(function SynergyResults({
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
          {renderCardDetail && <CardDetail card={selectedCard} onClear={onClearSelection} />}

          {synergies.length === 0 ? (
            <div
              role="status"
              aria-live="polite"
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
              <div
                aria-live="polite"
                aria-atomic="true"
                data-testid="synergy-header"
                style={{
                  marginBottom: `${SPACING.md}px`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: `${SPACING.sm}px`,
                }}>
                <span
                  style={{
                    fontSize: `${FONT_SIZES.xl}px`,
                    fontWeight: 700,
                    color: COLORS.text,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                  }}>
                  Synergies
                </span>
                <span
                  style={{
                    background: COLORS.primary100,
                    color: COLORS.primary,
                    padding: '2px 8px',
                    borderRadius: `${RADIUS.sm}px`,
                    fontSize: `${FONT_SIZES.sm}px`,
                    fontWeight: 700,
                    minWidth: 20,
                    textAlign: 'center',
                  }}>
                  {totalSynergyCount}
                </span>
              </div>
              <div
                style={{
                  height: 1,
                  background: COLORS.surfaceBorder,
                  marginBottom: `${SPACING.lg}px`,
                }}
              />
              {synergies.map((group) => (
                <SynergyGroup key={group.type} group={group} />
              ))}
            </>
          )}
        </>
      )}
    </div>
  );
});
