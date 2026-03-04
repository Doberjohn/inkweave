import {useRef, useState, forwardRef} from 'react';
import {motion, AnimatePresence} from 'framer-motion';
import type {LorcanaCard} from '../../cards';
import type {DetailedPairSynergy, PairSynergyConnection} from 'lorcana-synergy-engine';
import {getStrengthTier} from '../utils';
import {CardImage} from '../../../shared/components';
import {useDialogFocus} from '../../../shared/hooks/useDialogFocus';
import {COLORS, FONT_SIZES, SPACING, RADIUS, Z_INDEX} from '../../../shared/constants';

interface SynergyDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  pair: DetailedPairSynergy;
  onViewSynergies: (cardId: string) => void;
}

export function SynergyDetailModal({
  isOpen,
  onClose,
  pair,
  onViewSynergies,
}: SynergyDetailModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [ctaHovered, setCtaHovered] = useState(false);

  const {handleKeyDown} = useDialogFocus({
    isOpen,
    containerRef: modalRef,
    initialFocusRef: closeButtonRef,
    onClose,
  });

  const {cardA, cardB, connections, aggregateScore} = pair;
  const tier = getStrengthTier(aggregateScore);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{opacity: 0}}
            animate={{opacity: 1}}
            exit={{opacity: 0}}
            transition={{duration: 0.2}}
            aria-hidden="true"
            onClick={onClose}
            data-testid="synergy-detail-backdrop"
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.6)',
              zIndex: Z_INDEX.modalBackdrop,
              cursor: 'pointer',
              backdropFilter: 'blur(4px)',
            }}
          />

          {/* Centering wrapper */}
          <div
            style={{
              position: 'fixed',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: Z_INDEX.modal,
              pointerEvents: 'none',
              padding: 24,
            }}>
            <motion.div
              ref={modalRef}
              initial={{opacity: 0, scale: 0.95}}
              animate={{opacity: 1, scale: 1}}
              exit={{opacity: 0, scale: 0.95}}
              transition={{duration: 0.2, ease: 'easeOut'}}
              role="dialog"
              aria-modal="true"
              aria-label="Synergy detail"
              data-testid="synergy-detail-modal"
              onKeyDown={handleKeyDown}
              style={{
                width: '100%',
                maxWidth: 580,
                maxHeight: 'calc(100vh - 48px)',
                overflowY: 'auto',
                background: COLORS.surface,
                borderRadius: `${RADIUS.xl}px`,
                border: `1px solid ${COLORS.surfaceBorder}`,
                boxShadow: '0 24px 64px rgba(0, 0, 0, 0.5), 0 0 1px rgba(51, 51, 85, 0.8)',
                position: 'relative',
                pointerEvents: 'auto',
              }}>
              {/* Close button */}
              <CloseButton ref={closeButtonRef} onClick={onClose} />

              {/* Card pair + connector */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'center',
                  padding: '24px 24px 0',
                }}>
                <PairCard card={cardA} />
                <Connector score={aggregateScore} tier={tier} />
                <PairCard card={cardB} />
              </div>

              {/* Aggregate tier label */}
              <div style={{textAlign: 'center', padding: '14px 24px 20px'}}>
                <h2
                  style={{
                    fontSize: `${FONT_SIZES.base}px`,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    color: COLORS.textMuted,
                    margin: 0,
                  }}>
                  <span style={{color: tier.color}}>{tier.label}</span> Synergy
                </h2>
              </div>

              {/* Connections list */}
              {connections.length > 0 && (
                <div
                  style={{
                    margin: '0 24px 20px',
                    padding: `${SPACING.lg}px`,
                    background: COLORS.surfaceAlt,
                    borderRadius: `${RADIUS.md}px`,
                    border: `1px solid ${COLORS.surfaceBorder}`,
                  }}>
                  <div
                    style={{
                      fontSize: `${FONT_SIZES.xs}px`,
                      fontWeight: 600,
                      color: COLORS.textMuted,
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      marginBottom: `${SPACING.md}px`,
                    }}>
                    Connections
                  </div>
                  <div style={{display: 'flex', flexDirection: 'column'}}>
                    {connections.map((conn, i) => (
                      <ConnectionItem key={conn.ruleId} connection={conn} isFirst={i === 0} />
                    ))}
                  </div>
                </div>
              )}

              {/* CTA button */}
              <button
                onClick={() => onViewSynergies(cardB.id)}
                onMouseEnter={() => setCtaHovered(true)}
                onMouseLeave={() => setCtaHovered(false)}
                data-testid="synergy-detail-cta"
                style={{
                  display: 'block',
                  width: 'calc(100% - 48px)',
                  margin: '0 24px 24px',
                  padding: '10px 20px',
                  borderRadius: `${RADIUS.md}px`,
                  border: `1px solid rgba(212, 175, 55, ${ctaHovered ? 0.5 : 0.3})`,
                  background: `rgba(212, 175, 55, ${ctaHovered ? 0.12 : 0.06})`,
                  color: COLORS.primary,
                  fontSize: `${FONT_SIZES.base}px`,
                  fontWeight: 600,
                  cursor: 'pointer',
                  textAlign: 'center',
                  fontFamily: 'inherit',
                  transition: 'all 0.2s',
                  boxShadow: ctaHovered ? '0 0 16px rgba(212, 175, 55, 0.1)' : 'none',
                }}>
                View {cardB.fullName} synergies →
              </button>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

// ── Subcomponents ──

const CloseButton = forwardRef<HTMLButtonElement, {onClick: () => void}>(function CloseButton(
  {onClick},
  ref,
) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      ref={ref}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label="Close"
      style={{
        position: 'absolute',
        top: 12,
        right: 12,
        width: 32,
        height: 32,
        borderRadius: `${RADIUS.sm}px`,
        border: 'none',
        background: hovered ? 'rgba(212, 175, 55, 0.12)' : 'rgba(21, 21, 37, 0.8)',
        color: hovered ? COLORS.primary : COLORS.textMuted,
        fontSize: `${FONT_SIZES.md}px`,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'background 0.15s, color 0.15s',
        zIndex: 2,
      }}>
      ×
    </button>
  );
});

function PairCard({card}: {card: LorcanaCard}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: 160,
      }}>
      <CardImage
        src={card.imageUrl}
        alt={card.fullName}
        width={140}
        height={196}
        inkColor={card.ink}
        cost={card.cost}
        borderRadius={10}
      />
      <div
        style={{
          fontSize: `${FONT_SIZES.base}px`,
          fontWeight: 700,
          color: COLORS.text,
          marginTop: 12,
          textAlign: 'center',
        }}>
        {card.name}
      </div>
      {card.version && (
        <div
          style={{
            fontSize: `${FONT_SIZES.base}px`,
            color: COLORS.textMuted,
            textAlign: 'center',
            marginTop: 2,
          }}>
          {card.version}
        </div>
      )}
    </div>
  );
}

function Connector({score, tier}: {score: number; tier: ReturnType<typeof getStrengthTier>}) {
  const lineColor = `${tier.color}59`; // ~35% opacity
  const circleBorderColor = `${tier.color}80`; // ~50% opacity
  const circleGlow = `${tier.color}1a`; // ~10% opacity

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        // Center on card images: (196px image - 48px circle) / 2 = 74px
        marginTop: 74,
        flexShrink: 0,
      }}>
      <div style={{width: 20, borderTop: `1px dashed ${lineColor}`}} />
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: `${FONT_SIZES.xxl}px`,
          fontWeight: 700,
          flexShrink: 0,
          border: `2px solid ${circleBorderColor}`,
          background: `${tier.color}0f`,
          color: tier.color,
          boxShadow: `0 0 24px ${circleGlow}`,
        }}>
        {score}
      </div>
      <div style={{width: 20, borderTop: `1px dashed ${lineColor}`}} />
    </div>
  );
}

function ConnectionItem({
  connection,
  isFirst,
}: {
  connection: PairSynergyConnection;
  isFirst: boolean;
}) {
  const tier = getStrengthTier(connection.score);

  return (
    <div
      style={{
        padding: '12px 0',
        borderTop: isFirst ? 'none' : '1px solid rgba(51, 51, 85, 0.5)',
        ...(isFirst ? {paddingTop: 0} : {}),
      }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: `${SPACING.sm}px`,
          marginBottom: `${SPACING.sm}px`,
        }}>
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: tier.color,
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontSize: `${FONT_SIZES.base}px`,
            fontWeight: 600,
            color: COLORS.text,
          }}>
          {connection.ruleName}
        </span>
        <span
          style={{
            marginLeft: 'auto',
            padding: '2px 7px',
            borderRadius: `${RADIUS.xs}px`,
            fontSize: `${FONT_SIZES.xs}px`,
            fontWeight: 600,
            lineHeight: 1.4,
            background: tier.bg,
            color: tier.color,
            flexShrink: 0,
          }}>
          {tier.label} {connection.score}
        </span>
      </div>
      <p
        style={{
          margin: 0,
          fontSize: `${FONT_SIZES.base}px`,
          lineHeight: 1.5,
          color: COLORS.descriptionText,
          paddingLeft: 14,
        }}>
        {connection.explanation}
      </p>
    </div>
  );
}
