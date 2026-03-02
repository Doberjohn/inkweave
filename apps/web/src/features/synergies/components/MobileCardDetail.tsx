import {useState, useMemo} from 'react';
import type {LorcanaCard} from '../../cards';
import type {SynergyGroup as SynergyGroupData} from '../types';
import {getDominantScore, getStrengthTier} from '../utils';
import {SynergyGroup} from './SynergyGroup';
import {CardImage, CardLightbox, CardTextBlock} from '../../../shared/components';
import {COLORS, FONT_SIZES, FONTS, RADIUS, SPACING} from '../../../shared/constants';

interface MobileCardDetailProps {
  card: LorcanaCard;
  synergies: SynergyGroupData[];
  totalSynergyCount: number;
  onBack: () => void;
}

function chipStyle(active: boolean): React.CSSProperties {
  return {
    padding: '8px 14px',
    borderRadius: '20px',
    fontSize: `${FONT_SIZES.base}px`,
    fontWeight: 500,
    cursor: 'pointer',
    border: active ? '1px solid rgba(212, 175, 55, 0.4)' : `1px solid ${COLORS.surfaceBorder}`,
    background: active ? 'rgba(212, 175, 55, 0.12)' : 'transparent',
    color: active ? COLORS.primary500 : COLORS.textMuted,
    boxShadow: active
      ? '0 0 12px rgba(212, 175, 55, 0.15), inset 0 0 8px rgba(212, 175, 55, 0.05)'
      : 'none',
    transition: 'all 0.2s',
    fontFamily: FONTS.body,
    whiteSpace: 'nowrap',
    flexShrink: 0,
    minHeight: '44px',
    display: 'flex',
    alignItems: 'center',
  };
}

/** Mobile-only card detail view with inline synergy groups. */
export function MobileCardDetail({
  card,
  synergies,
  totalSynergyCount,
  onBack,
}: MobileCardDetailProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [activeGroupFilter, setActiveGroupFilter] = useState<string | null>(null);

  const filteredGroups = useMemo(() => {
    if (!activeGroupFilter) return synergies;
    return synergies.filter((g) => g.groupKey === activeGroupFilter);
  }, [synergies, activeGroupFilter]);

  return (
    <main
      style={{
        minHeight: '100vh',
        background: COLORS.background,
        fontFamily: FONTS.body,
        position: 'relative',
        overflowX: 'hidden',
      }}>
      {/* Ethereal glow orb */}
      <div
        style={{
          position: 'absolute',
          top: -50,
          left: -80,
          width: 300,
          height: 300,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      {/* Compact header */}
      <div
        style={{
          height: 48,
          background: 'linear-gradient(180deg, #0d0d14 0%, #1a1a2e 100%)',
          display: 'flex',
          alignItems: 'center',
          paddingLeft: SPACING.lg,
          borderBottom: `1px solid ${COLORS.surfaceBorder}`,
          position: 'sticky',
          top: 0,
          zIndex: 902,
        }}>
        <button
          onClick={onBack}
          aria-label="Back to home"
          style={{
            background: 'none',
            border: 'none',
            color: COLORS.primary500,
            fontSize: FONT_SIZES.md,
            fontWeight: 700,
            letterSpacing: '0.96px',
            cursor: 'pointer',
            padding: `${SPACING.sm}px 0`,
            fontFamily: FONTS.body,
          }}>
          INKWEAVE
        </button>
      </div>

      <div style={{position: 'relative', zIndex: 1, padding: `${SPACING.lg}px`}}>
        {/* Card image — centered with gold glow border */}
        <div style={{display: 'flex', justifyContent: 'center', marginBottom: SPACING.lg}}>
          <button
            aria-label="Enlarge card image"
            onClick={() => card.imageUrl && setLightboxOpen(true)}
            style={{
              border: 'none',
              borderRadius: 12,
              overflow: 'hidden',
              cursor: 'pointer',
              padding: 0,
              background: 'none',
            }}>
            <CardImage
              src={card.imageUrl}
              alt={card.fullName}
              width={220}
              height={308}
              inkColor={card.ink}
              cost={card.cost}
              lazy={false}
              borderRadius={10}
            />
          </button>
        </div>

        {/* Card name + version */}
        <h1
          style={{
            textAlign: 'center',
            fontSize: `${FONT_SIZES.xxl}px`,
            fontWeight: 700,
            color: COLORS.text,
            margin: 0,
            lineHeight: 1.2,
          }}>
          {card.name}
        </h1>
        {card.version && (
          <div
            style={{
              textAlign: 'center',
              fontSize: `${FONT_SIZES.base}px`,
              color: COLORS.textMuted,
              marginTop: 3,
            }}>
            {card.version}
          </div>
        )}

        {/* Ability text */}
        {(card.textSections?.length || card.text) && (
          <div
            style={{
              marginTop: SPACING.md,
              background: COLORS.surfaceAlt,
              border: `1px solid ${COLORS.surfaceBorder}`,
              borderRadius: RADIUS.md,
              padding: `${SPACING.md}px`,
            }}>
            <CardTextBlock card={card} />
          </div>
        )}

        {/* Synergy breakdown */}
        {synergies.length > 0 && (
          <div
            style={{
              marginTop: SPACING.lg,
              padding: `${SPACING.md}px`,
              background: COLORS.surfaceAlt,
              borderRadius: `${RADIUS.md}px`,
              border: `1px solid ${COLORS.surfaceBorder}`,
            }}>
            <div
              style={{
                fontSize: FONT_SIZES.xs,
                fontWeight: 600,
                color: COLORS.textMuted,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                marginBottom: 10,
              }}>
              Synergy Breakdown
            </div>

            <div style={{display: 'flex', flexDirection: 'column', gap: '2px'}}>
              {synergies.map((group) => {
                const tier = getStrengthTier(getDominantScore(group.synergies));
                return (
                  <div
                    key={group.groupKey}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '8px',
                      borderRadius: RADIUS.sm,
                      minHeight: 44,
                    }}>
                    {/* Count circle */}
                    <div
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: '50%',
                        background: tier.bg,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                      <span
                        style={{
                          fontSize: FONT_SIZES.xs,
                          fontWeight: 700,
                          color: tier.color,
                        }}>
                        {group.synergies.length}
                      </span>
                    </div>

                    {/* Group label */}
                    <span
                      style={{
                        flex: 1,
                        fontSize: FONT_SIZES.base,
                        fontWeight: 500,
                        color: COLORS.text,
                      }}>
                      {group.label}
                    </span>

                    {/* Arrow */}
                    <span style={{fontSize: FONT_SIZES.xs, color: COLORS.textMuted}}>&rarr;</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Synergy section divider */}
        {synergies.length > 0 && (
          <>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: `${SPACING.lg}px 0 ${SPACING.sm}px`,
              }}>
              <div style={{flex: 1, height: 1, background: COLORS.surfaceBorder}} />
              <h2
                style={{
                  margin: 0,
                  fontSize: `${FONT_SIZES.xl}px`,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: COLORS.text,
                }}>
                Synergies
              </h2>
              <span
                style={{
                  background: COLORS.calloutBg,
                  color: COLORS.primary,
                  padding: '2px 8px',
                  borderRadius: `${RADIUS.sm}px`,
                  fontSize: `${FONT_SIZES.xs}px`,
                  fontWeight: 700,
                }}>
                {totalSynergyCount}
              </span>
              <div style={{flex: 1, height: 1, background: COLORS.surfaceBorder}} />
            </div>

            {/* Group chips — horizontal scroll */}
            <div
              style={{
                display: 'flex',
                gap: '8px',
                overflowX: 'auto',
                paddingBottom: '4px',
                marginBottom: SPACING.lg,
                WebkitOverflowScrolling: 'touch',
                scrollbarWidth: 'none',
              }}>
              <button
                onClick={() => setActiveGroupFilter(null)}
                style={chipStyle(activeGroupFilter === null)}>
                All
              </button>
              {synergies.map((g) => (
                <button
                  key={g.groupKey}
                  onClick={() => setActiveGroupFilter(g.groupKey)}
                  style={chipStyle(activeGroupFilter === g.groupKey)}>
                  {g.label}
                </button>
              ))}
            </div>

            {/* Synergy groups */}
            {filteredGroups.map((group) => (
              <SynergyGroup key={group.groupKey} group={group} isMobile maxVisibleCards={5} />
            ))}
          </>
        )}

        {/* Empty state */}
        {synergies.length === 0 && (
          <p
            style={{
              textAlign: 'center',
              fontSize: FONT_SIZES.base,
              color: COLORS.textMuted,
              margin: `${SPACING.xxl}px 0`,
            }}>
            No synergies found for this card.
          </p>
        )}
      </div>

      {lightboxOpen && card.imageUrl && (
        <CardLightbox
          src={card.imageUrl}
          alt={card.fullName}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </main>
  );
}
