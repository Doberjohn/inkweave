import {useRef, useState, useMemo, useEffect, forwardRef} from 'react';
import {motion, AnimatePresence} from 'framer-motion';
import type {LorcanaCard} from '../../cards';
import {useCardPreviewHandlers, useCardPreview} from '../../cards';
import type {
  DetailedPairSynergy,
  PairSynergyConnection,
  LocationRole,
} from 'lorcana-synergy-engine';
import {
  getPlaystyleById,
  LOCATION_ROLE_CHIP_LABELS,
  LOCATION_ROLE_DESCRIPTIONS,
} from 'lorcana-synergy-engine';
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

  // Hide any card popover immediately when modal starts closing (before exit animation)
  const {hidePreview} = useCardPreview();
  useEffect(() => {
    if (!isOpen) hidePreview();
  }, [isOpen, hidePreview]);

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
                <PairCard card={cardA} showVersion={cardA.name === cardB.name} />
                <Connector score={aggregateScore} tier={tier} />
                <PairCard card={cardB} showVersion={cardA.name === cardB.name} />
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
                <ConnectionsSection connections={connections} cardA={cardA} cardB={cardB} />
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

function PairCard({card, showVersion}: {card: LorcanaCard; showVersion?: boolean}) {
  const {previewHandlers} = useCardPreviewHandlers({card});

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: 160,
      }}>
      <div {...previewHandlers}>
        <CardImage
          src={card.imageUrl}
          alt={card.fullName}
          width={140}
          height={196}
          inkColor={card.ink}
          cost={card.cost}
          borderRadius={10}
        />
      </div>
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
      {showVersion && card.version && (
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

/** A grouped connection: either a single direct rule or multiple playstyle rules merged by playstyleId */
interface ConnectionGroupData {
  key: string;
  label: string;
  score: number;
  connections: PairSynergyConnection[];
  category: 'direct' | 'playstyle';
}

/** Group connections: playstyle rules merge by playstyleId, direct rules stay individual */
function groupConnections(connections: PairSynergyConnection[]): ConnectionGroupData[] {
  const playstyleGroups = new Map<string, PairSynergyConnection[]>();
  const result: ConnectionGroupData[] = [];

  for (const conn of connections) {
    if (conn.category === 'playstyle') {
      const existing = playstyleGroups.get(conn.playstyleId);
      if (existing) {
        existing.push(conn);
      } else {
        playstyleGroups.set(conn.playstyleId, [conn]);
      }
    } else {
      result.push({
        key: conn.ruleId,
        label: conn.ruleName,
        score: conn.score,
        connections: [conn],
        category: 'direct',
      });
    }
  }

  for (const [playstyleId, conns] of playstyleGroups) {
    const playstyle = getPlaystyleById(playstyleId);
    const maxScore = Math.max(...conns.map((c) => c.score));
    result.push({
      key: playstyleId,
      label: playstyle?.name ?? playstyleId,
      score: maxScore,
      connections: conns,
      category: 'playstyle',
    });
  }

  return result.sort((a, b) => b.score - a.score);
}

/** Extract LocationRole from a location rule ID (e.g. "location-at-payoff" → "at-payoff") */
function extractLocationRole(ruleId: string): LocationRole | null {
  const prefix = 'location-';
  if (!ruleId.startsWith(prefix)) return null;
  return ruleId.slice(prefix.length) as LocationRole;
}

/** Determine which card contributes a location role in a pair connection */
function getRoleSourceName(
  conn: PairSynergyConnection,
  cardA: LorcanaCard,
  cardB: LorcanaCard,
): string {
  // Use fullName when both cards share the same base name to disambiguate
  const nameOf = (card: LorcanaCard) => (cardA.name === cardB.name ? card.fullName : card.name);

  // Location ↔ support: the non-Location card has the role
  if (cardA.type === 'Location' && cardB.type !== 'Location') return nameOf(cardB);
  if (cardB.type === 'Location' && cardA.type !== 'Location') return nameOf(cardA);
  // Cross-synergy: source card name starts the explanation
  if (conn.explanation.startsWith(cardA.name)) return nameOf(cardA);
  if (conn.explanation.startsWith(cardB.name)) return nameOf(cardB);
  return nameOf(cardA);
}

function ConnectionsSection({
  connections,
  cardA,
  cardB,
}: {
  connections: PairSynergyConnection[];
  cardA: LorcanaCard;
  cardB: LorcanaCard;
}) {
  const groups = useMemo(() => groupConnections(connections), [connections]);

  return (
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
      <div style={{display: 'flex', flexDirection: 'column', gap: `${SPACING.sm}px`}}>
        {groups.map((group) => (
          <ConnectionGroupRow key={group.key} group={group} cardA={cardA} cardB={cardB} />
        ))}
      </div>
    </div>
  );
}

function ConnectionGroupRow({
  group,
  cardA,
  cardB,
}: {
  group: ConnectionGroupData;
  cardA: LorcanaCard;
  cardB: LorcanaCard;
}) {
  const [expanded, setExpanded] = useState(false);
  const [hovered, setHovered] = useState(false);
  const tier = getStrengthTier(group.score);
  const hasMultipleRoles = group.connections.length > 1;

  return (
    <div
      style={{
        background: COLORS.surface,
        borderRadius: `${RADIUS.md}px`,
        border: `1px solid ${expanded ? 'rgba(212, 175, 55, 0.2)' : COLORS.surfaceBorder}`,
        overflow: 'hidden',
        transition: 'border-color 0.15s',
      }}>
      {/* Collapsed header row */}
      <button
        onClick={() => setExpanded(!expanded)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        aria-expanded={expanded}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: `${SPACING.sm}px`,
          width: '100%',
          padding: '10px 12px',
          background: hovered ? 'rgba(255, 255, 255, 0.02)' : 'transparent',
          border: 'none',
          cursor: 'pointer',
          fontFamily: 'inherit',
          transition: 'background 0.15s',
        }}>
        <span
          style={{
            width: 8,
            height: 8,
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
          {group.label}
        </span>
        <span
          style={{
            padding: '2px 6px',
            borderRadius: `${RADIUS.xs}px`,
            fontSize: `${FONT_SIZES.xs}px`,
            fontWeight: 700,
            background: tier.bg,
            color: tier.color,
            flexShrink: 0,
          }}>
          {group.score}
        </span>
        {hasMultipleRoles && (
          <span
            style={{
              fontSize: `${FONT_SIZES.xs}px`,
              fontWeight: 500,
              color: COLORS.textMuted,
            }}>
            {group.connections.length} roles
          </span>
        )}
        <span
          style={{
            marginLeft: 'auto',
            fontSize: `${FONT_SIZES.base}px`,
            color: expanded ? COLORS.primary : COLORS.textMuted,
            transition: 'color 0.15s, transform 0.15s',
            transform: expanded ? 'rotate(90deg)' : 'none',
            lineHeight: 1,
          }}>
          ▸
        </span>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div
          style={{
            borderTop: `1px solid ${COLORS.surfaceBorder}`,
            padding: '10px 12px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: `${SPACING.sm}px`,
          }}>
          {group.connections.map((conn) => {
            const role = extractLocationRole(conn.ruleId);
            const chipLabel = role ? LOCATION_ROLE_CHIP_LABELS[role] : null;
            const description = role
              ? LOCATION_ROLE_DESCRIPTIONS[role](getRoleSourceName(conn, cardA, cardB))
              : conn.explanation;

            return (
              <div
                key={conn.ruleId}
                style={{
                  display: 'flex',
                  alignItems: 'start',
                  gap: `${SPACING.sm}px`,
                }}>
                {chipLabel ? (
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: 8,
                      background: 'rgba(212, 175, 55, 0.1)',
                      color: COLORS.primary,
                      fontSize: `${FONT_SIZES.xs}px`,
                      fontWeight: 600,
                      flexShrink: 0,
                      marginTop: 1,
                    }}>
                    {chipLabel}
                  </span>
                ) : (
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: getStrengthTier(conn.score).color,
                      flexShrink: 0,
                      marginTop: 5,
                    }}
                  />
                )}
                <span
                  style={{
                    fontSize: `${FONT_SIZES.base}px`,
                    lineHeight: 1.4,
                    color: COLORS.descriptionText,
                  }}>
                  {description}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
