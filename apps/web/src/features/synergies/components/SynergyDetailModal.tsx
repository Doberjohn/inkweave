import {Fragment, useRef, useState, useEffect} from 'react';
import type {LorcanaCard} from '../../cards';
import {useCardPreviewHandlers, useCardPreview} from '../../cards';
import type {
  DetailedPairSynergy,
  PairSynergyConnection,
  LocationRole,
} from 'inkweave-synergy-engine';
import {
  getPlaystyleById,
  LOCATION_ROLE_CHIP_LABELS,
  LOCATION_ROLE_DESCRIPTIONS,
} from 'inkweave-synergy-engine';
import {getStrengthTier} from '../utils';
import {CardImage, CardLightbox, RenderProfiler} from '../../../shared/components';
import {useDialogFocus} from '../../../shared/hooks/useDialogFocus';
import {useScrollLock, useTransitionPresence, useResponsive} from '../../../shared/hooks';
import {COLORS, FONT_SIZES, SPACING, RADIUS, Z_INDEX} from '../../../shared/constants';
import {StrengthBadge} from '../../../shared/components';

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
  const [ctaHovered, setCtaHovered] = useState(false);
  const {isMobile} = useResponsive();

  const {mounted, visible, onTransitionEnd} = useTransitionPresence(isOpen);
  useScrollLock(isOpen);

  const initialFocusRef = useRef<HTMLElement>(null);
  const {handleKeyDown} = useDialogFocus({
    isOpen,
    containerRef: modalRef,
    initialFocusRef,
    onClose,
  });

  // Hide any card popover immediately when modal starts closing (before exit animation)
  const {hidePreview} = useCardPreview();
  useEffect(() => {
    if (!isOpen) hidePreview();
  }, [isOpen, hidePreview]);

  const {cardA, cardB, connections, aggregateScore} = pair;
  const tier = getStrengthTier(aggregateScore);

  if (!mounted) return null;

  return (
    <RenderProfiler id="SynergyDetailModal">
    <>
      {/* Backdrop */}
      <div
        className={`overlay-transition overlay-enter ${visible ? 'overlay-visible' : ''}`}
        aria-hidden="true"
        onClick={onClose}
        data-testid="synergy-detail-backdrop"
        onTransitionEnd={onTransitionEnd}
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
        {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- dialog keyboard handling (Escape to close) */}
        <div
          ref={modalRef}
          className={`overlay-transition overlay-scale overlay-enter ${visible ? 'overlay-visible' : ''}`}
          role="dialog"
          aria-modal="true"
          aria-label="Synergy detail"
          data-testid="synergy-detail-modal"
          onKeyDown={handleKeyDown}
          onTransitionEnd={onTransitionEnd}
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
          {/* Card images + connector (centered) */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '24px 12px 0',
            }}>
            <PairCardImage card={cardA} isMobile={isMobile} />
            <Connector score={aggregateScore} tier={tier} isMobile={isMobile} />
            <PairCardImage card={cardB} isMobile={isMobile} />
          </div>

          {/* Card names row */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              padding: '12px 12px 0',
              gap: 60,
            }}>
            <PairCardName card={cardA} showVersion={cardA.name === cardB.name} />
            <PairCardName card={cardB} showVersion={cardA.name === cardB.name} />
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
            View {cardB.fullName} synergies
          </button>
        </div>
      </div>
    </>
    </RenderProfiler>
  );
}

// ── Subcomponents ──

function PairCardImage({card, isMobile}: {card: LorcanaCard; isMobile?: boolean}) {
  const {previewHandlers} = useCardPreviewHandlers({card});
  const [lightboxOpen, setLightboxOpen] = useState(false);

  return (
    <div
      style={{
        flex: '1 1 0',
        minWidth: 0,
        maxWidth: 140,
        display: 'flex',
        justifyContent: 'center',
      }}>
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- mobile-only tap-to-enlarge; lightbox is supplementary, not a primary action */}
      <div
        {...(isMobile ? {} : previewHandlers)}
        onClick={isMobile && card.imageUrl ? () => setLightboxOpen(true) : undefined}
        style={{cursor: isMobile ? 'pointer' : undefined, width: '100%'}}>
        <CardImage
          src={card.imageUrl}
          alt={card.fullName}
          width={140}
          height={196}
          inkColor={card.ink}
          cost={card.cost}
          borderRadius={10}
          style={{width: '100%', height: 'auto', maxWidth: 140}}
        />
      </div>
      {lightboxOpen && card.imageUrl && (
        <CardLightbox
          src={card.imageUrl}
          alt={card.fullName}
          isLocation={card.type === 'Location'}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </div>
  );
}

function PairCardName({card, showVersion}: {card: LorcanaCard; showVersion?: boolean}) {
  return (
    <div
      style={{
        flex: '1 1 0',
        minWidth: 0,
        maxWidth: 140,
        textAlign: 'center',
      }}>
      <div
        style={{
          fontSize: `${FONT_SIZES.base}px`,
          fontWeight: 700,
          color: COLORS.text,
        }}>
        {card.name}
      </div>
      {showVersion && card.version && (
        <div
          style={{
            fontSize: `${FONT_SIZES.base}px`,
            color: COLORS.textMuted,
            marginTop: 2,
          }}>
          {card.version}
        </div>
      )}
    </div>
  );
}

function Connector({
  score,
  tier,
  isMobile,
}: {
  score: number;
  tier: ReturnType<typeof getStrengthTier>;
  isMobile: boolean;
}) {
  const lineColor = `${tier.color}59`; // ~35% opacity
  const circleBorderColor = `${tier.color}80`; // ~50% opacity
  const circleGlow = `${tier.color}1a`; // ~10% opacity
  const size = isMobile ? 32 : 44;
  const fontSize = isMobile ? FONT_SIZES.base : FONT_SIZES.xl;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        flexShrink: 0,
        minWidth: isMobile ? 44 : 140,
        margin: isMobile ? '0 6px' : '0 2px',
      }}>
      {!isMobile && <div style={{width: 3}} />}
      <DashedLine color={lineColor} isMobile={isMobile} />
      {!isMobile && <div style={{width: 3}} />}
      <div
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: `${fontSize}px`,
          fontWeight: 700,
          flexShrink: 0,
          border: `2px solid ${circleBorderColor}`,
          background: `${tier.color}0f`,
          color: tier.color,
          boxShadow: `0 0 24px ${circleGlow}`,
        }}>
        {score}
      </div>
      {!isMobile && <div style={{width: 3}} />}
      <DashedLine color={lineColor} isMobile={isMobile} />
      {!isMobile && <div style={{width: 3}} />}
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
  const groups = groupConnections(connections);

  return (
    <div
      style={{
        margin: '0 24px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: `${SPACING.sm}px`,
      }}>
      {groups.map((group) => (
        <ConnectionGroupRow key={group.key} group={group} cardA={cardA} cardB={cardB} />
      ))}
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
  const [expanded, setExpanded] = useState(true);
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
        <StrengthBadge tier={tier} size="lg">
          {group.score}
        </StrengthBadge>
        <span
          style={{
            fontSize: `${FONT_SIZES.base}px`,
            fontWeight: 600,
            color: COLORS.text,
          }}>
          {group.label}
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
            display: 'grid',
            gridTemplateColumns: hasMultipleRoles ? 'auto 1fr' : '1fr',
            gap: `${SPACING.sm}px`,
            alignItems: 'start',
          }}>
          {group.connections.map((conn, i) => {
            const role = extractLocationRole(conn.ruleId);
            const chipLabel = role ? LOCATION_ROLE_CHIP_LABELS[role] : null;
            const description = role
              ? LOCATION_ROLE_DESCRIPTIONS[role](getRoleSourceName(conn, cardA, cardB))
              : conn.explanation;
            const divider = i > 0 && (
              <div
                key={`${conn.ruleId}-divider`}
                style={{
                  gridColumn: '1 / -1',
                  height: 1,
                  background: COLORS.surfaceBorder,
                }}
              />
            );

            return hasMultipleRoles ? (
              <Fragment key={conn.ruleId}>
                {divider}
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: 8,
                    background: chipLabel ? 'rgba(212, 175, 55, 0.1)' : 'transparent',
                    color: COLORS.primary,
                    fontSize: `${FONT_SIZES.xs}px`,
                    fontWeight: 600,
                    textAlign: 'center',
                    whiteSpace: 'nowrap',
                    marginTop: 1,
                  }}>
                  {chipLabel ?? ''}
                </span>
                <span
                  style={{
                    fontSize: `${FONT_SIZES.base}px`,
                    lineHeight: 1.4,
                    color: COLORS.descriptionText,
                  }}>
                  {description}
                </span>
              </Fragment>
            ) : (
              <Fragment key={conn.ruleId}>
                {divider}
                <span
                  style={{
                    fontSize: `${FONT_SIZES.base}px`,
                    lineHeight: 1.4,
                    color: COLORS.descriptionText,
                  }}>
                  {description}
                </span>
              </Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DashedLine({color, isMobile}: {color: string; isMobile: boolean}) {
  return (
    <svg
      style={{flex: '1 1 6px', maxWidth: isMobile ? 14 : 44, overflow: 'visible'}}
      height="2"
      preserveAspectRatio="none">
      <line
        x1="0"
        y1="1"
        x2="100%"
        y2="1"
        stroke={color}
        strokeWidth="1.5"
        strokeDasharray={isMobile ? '3 3' : '6 6'}
      />
    </svg>
  );
}
