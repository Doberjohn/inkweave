import {useState} from 'react';
import {useNavigate} from 'react-router-dom';
import type {LorcanaCard} from '../../cards';
import type {GroupedSynergies} from '../types';
import {getDominantStrength} from '../utils';
import {CardImage, CardLightbox, CardTextBlock} from '../../../shared/components';
import {
  COLORS,
  FONT_SIZES,
  FONTS,
  INK_COLORS,
  RADIUS,
  SPACING,
  STRENGTH_STYLES,
} from '../../../shared/constants';

interface MobileCardDetailProps {
  card: LorcanaCard;
  synergies: GroupedSynergies[];
  totalSynergyCount: number;
  onBack: () => void;
}

/** Mobile-only card detail view with synergy breakdown summary and CTA. */
export function MobileCardDetail({card, synergies, totalSynergyCount, onBack}: MobileCardDetailProps) {
  const navigate = useNavigate();
  const [lightboxOpen, setLightboxOpen] = useState(false);

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
          background: 'rgba(26, 26, 46, 0.9)',
          display: 'flex',
          alignItems: 'center',
          paddingLeft: SPACING.lg,
          borderBottom: `1px solid rgba(51, 51, 85, 0.5)`,
          position: 'relative',
          zIndex: 1,
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
          &larr; INKWEAVE
        </button>
      </div>

      <div style={{position: 'relative', zIndex: 1}}>
        {/* Card image — centered with gold glow border */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            paddingTop: SPACING.md,
          }}>
          <button
            aria-label="Enlarge card image"
            onClick={() => card.imageUrl && setLightboxOpen(true)}
            style={{
              border: `2px solid ${COLORS.primary500}`,
              borderRadius: RADIUS.xl - 4,
              boxShadow: `0 0 14px rgba(212, 175, 55, 0.25)`,
              overflow: 'hidden',
              cursor: 'pointer',
              padding: 0,
              background: 'none',
            }}>
            <CardImage
              src={card.imageUrl}
              alt={card.fullName}
              width={200}
              height={280}
              inkColor={card.ink}
              cost={card.cost}
              lazy={false}
              borderRadius={RADIUS.xl - 6}
            />
          </button>
        </div>

        <h2
          style={{
            textAlign: 'center',
            fontSize: 17,
            fontWeight: 700,
            color: COLORS.text,
            margin: `${SPACING.md}px 0 0`,
          }}>
          {card.fullName}
        </h2>

        {/* Keyword badges */}
        {card.keywords && card.keywords.length > 0 && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: SPACING.sm,
              marginTop: SPACING.sm,
            }}>
            {card.keywords.map((kw) => (
              <span
                key={kw}
                style={{
                  background: COLORS.surfaceAlt,
                  border: `1px solid ${COLORS.surfaceBorder}`,
                  borderRadius: RADIUS.sm + 1,
                  padding: '4px 10px',
                  fontSize: FONT_SIZES.xs,
                  fontWeight: 500,
                  color: INK_COLORS.Sapphire.text,
                }}>
                {kw}
              </span>
            ))}
          </div>
        )}

        {/* Ability text */}
        {(card.textSections?.length || card.text) && (
          <div
            style={{
              margin: `${SPACING.md}px ${SPACING.xxl}px 0`,
              background: COLORS.surfaceAlt,
              border: `1px solid ${COLORS.surfaceBorder}`,
              borderRadius: RADIUS.lg,
              padding: `${SPACING.sm}px ${SPACING.md}px`,
            }}>
            <CardTextBlock card={card} />
          </div>
        )}

        {/* Synergy breakdown */}
        {synergies.length > 0 && (
          <div style={{margin: `${SPACING.lg}px ${SPACING.xxl}px 0`}}>
            <p
              style={{
                fontSize: FONT_SIZES.xs,
                fontWeight: 700,
                color: COLORS.primary500,
                letterSpacing: '1.5px',
                margin: `0 0 ${SPACING.sm}px`,
              }}>
              SYNERGY BREAKDOWN
            </p>

            <div style={{display: 'flex', flexDirection: 'column', gap: SPACING.sm - 2}}>
              {synergies.map((group) => {
                const strength = getDominantStrength(group.synergies);
                const strengthStyle = STRENGTH_STYLES[strength];
                return (
                  <div
                    key={group.type}
                    style={{
                      background: COLORS.surfaceAlt,
                      borderRadius: RADIUS.md,
                      height: 34,
                      display: 'flex',
                      alignItems: 'center',
                      padding: `0 ${SPACING.sm}px`,
                    }}>
                    {/* Count circle */}
                    <div
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: '50%',
                        background: strengthStyle.bg,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                      <span
                        style={{
                          fontSize: FONT_SIZES.sm,
                          fontWeight: 700,
                          color: strengthStyle.text,
                        }}>
                        {group.synergies.length}
                      </span>
                    </div>

                    {/* Group label */}
                    <span
                      style={{
                        flex: 1,
                        fontSize: FONT_SIZES.md,
                        fontWeight: 500,
                        color: COLORS.text,
                        marginLeft: SPACING.sm,
                      }}>
                      {group.label}
                    </span>

                    {/* Strength badge */}
                    <span
                      style={{
                        background: strengthStyle.bg,
                        color: strengthStyle.text,
                        fontSize: FONT_SIZES.xs,
                        fontWeight: 500,
                        padding: '2px 8px',
                        borderRadius: RADIUS.sm,
                        textTransform: 'capitalize',
                      }}>
                      {strength}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Gold CTA button */}
        <div style={{padding: `${SPACING.lg}px ${SPACING.xxl}px`}}>
          {totalSynergyCount > 0 ? (
            <button
              onClick={() => navigate(`/card/${card.id}/synergies`)}
              style={{
                width: '100%',
                height: 44,
                background: COLORS.primary500,
                borderRadius: RADIUS.xl - 4,
                border: 'none',
                boxShadow: '0 2px 12px rgba(212, 175, 55, 0.3)',
                cursor: 'pointer',
                fontSize: 15,
                fontWeight: 700,
                color: COLORS.background,
                fontFamily: FONTS.body,
                WebkitTapHighlightColor: 'transparent',
              }}>
              {`View All ${totalSynergyCount} Synergies \u2192`}
            </button>
          ) : (
            <p
              style={{
                textAlign: 'center',
                fontSize: FONT_SIZES.base,
                color: COLORS.textMuted,
                margin: 0,
              }}>
              No synergies found for this card.
            </p>
          )}
        </div>
      </div>

      {lightboxOpen && card.imageUrl && (
        <CardLightbox src={card.imageUrl} alt={card.fullName} onClose={() => setLightboxOpen(false)} />
      )}
    </main>
  );
}
