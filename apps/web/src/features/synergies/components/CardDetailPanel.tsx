import {useState, type CSSProperties, type KeyboardEvent} from 'react';
import {Link} from 'react-router-dom';
import type {LorcanaCard} from '../../cards';
import type {SynergyGroup} from '../types';
import {getDominantScore, getStrengthTier} from '../utils';
import {COLORS, FONT_SIZES, RADIUS, SPACING, LAYOUT, TRUNCATE, hexRgba} from '../../../shared/constants';
import {CardImage, CardLightbox, CardTextBlock, TierCircle} from '../../../shared/components';

interface CardDetailPanelProps {
  card: LorcanaCard;
  /** Synergy groups. When provided, renders the breakdown inline. */
  synergies?: SynergyGroup[];
  onGroupClick?: (groupKey: string) => void;
  /** Currently active group filter. Highlights the matching row. */
  activeGroupKey?: string | null;
}

// ── Module helpers ──

function hasCardText(card: LorcanaCard): boolean {
  return !!(card.textSections?.length || card.text);
}

function hasSynergyGroups(synergies: SynergyGroup[] | undefined): synergies is SynergyGroup[] {
  return !!synergies && synergies.length > 0;
}

function activateOnEnterOrSpace(handler: () => void) {
  return (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    handler();
  };
}

function getRowBackground(isActive: boolean, isHovered: boolean): string {
  if (isActive) return hexRgba(COLORS.primary500, 0.1);
  if (isHovered) return hexRgba(COLORS.primary500, 0.08);
  return 'transparent';
}

function buildNameLinkStyle(hovered: boolean): CSSProperties {
  if (hovered) {
    return {
      color: COLORS.primary500,
      textDecoration: 'underline',
      textDecorationColor: COLORS.primary500,
      textUnderlineOffset: '3px',
      transition: 'color 0.15s',
    };
  }
  return {
    color: 'inherit',
    textDecoration: 'none',
    textDecorationColor: undefined,
    textUnderlineOffset: '3px',
    transition: 'color 0.15s',
  };
}

// ── Sub-components ──

function CardImageBox({card, onOpenLightbox}: {card: LorcanaCard; onOpenLightbox: () => void}) {
  const handleClick = () => {
    if (card.imageUrl) onOpenLightbox();
  };
  return (
    <div style={{display: 'flex', justifyContent: 'center'}}>
      <button
        type="button"
        aria-label="Enlarge card image"
        onClick={handleClick}
        style={{
          border: 'none',
          background: 'none',
          padding: 0,
          borderRadius: RADIUS.xl,
          overflow: 'hidden',
          cursor: card.imageUrl ? 'pointer' : 'default',
        }}>
        <CardImage
          src={card.imageUrl}
          alt={card.fullName}
          width={298}
          height={417}
          inkColor={card.ink}
          cost={card.cost}
          lazy={false}
          priority
          borderRadius={RADIUS.xl}
        />
      </button>
    </div>
  );
}

function CardLightboxGate({
  card,
  isOpen,
  onClose,
}: {
  card: LorcanaCard;
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!isOpen || !card.imageUrl) return null;
  return (
    <CardLightbox
      src={card.imageUrl}
      alt={card.fullName}
      isLocation={card.type === 'Location'}
      onClose={onClose}
    />
  );
}

function CardTitleBlock({card}: {card: LorcanaCard}) {
  const [nameHovered, setNameHovered] = useState(false);
  return (
    <div>
      {/*
        The h1 carries the full head term — name AND version (#524). It previously held
        only `card.name`, so 13 different Elsa cards all claimed the h1 "Elsa" while their
        titles differed, and the page's strongest heading was entirely anchor text for a
        link to /browse. The version stays a block-level span, so the rendered result is
        the same two lines as before; only the semantics changed.
      */}
      <h1
        style={{
          fontSize: `${FONT_SIZES.xxl}px`,
          fontWeight: 700,
          color: COLORS.text,
          margin: 0,
          lineHeight: 1.2,
        }}>
        {card.name}
        {card.version && (
          <span
            style={{
              display: 'block',
              fontSize: `${FONT_SIZES.base}px`,
              fontWeight: 400,
              color: COLORS.textMuted,
              marginTop: 3,
            }}>
            {card.version}
          </span>
        )}
      </h1>
      {/* The all-versions affordance, demoted out of the heading but kept in place. */}
      <Link
        to={`/browse?q=${encodeURIComponent(card.name)}`}
        style={{
          ...buildNameLinkStyle(nameHovered),
          display: 'inline-block',
          fontSize: `${FONT_SIZES.sm}px`,
          color: nameHovered ? COLORS.primary500 : COLORS.textMuted,
          marginTop: SPACING.sm,
        }}
        onMouseEnter={() => setNameHovered(true)}
        onMouseLeave={() => setNameHovered(false)}>
        All {card.name} cards →
      </Link>
    </div>
  );
}

function CardTextBox({card}: {card: LorcanaCard}) {
  return (
    <div
      style={{
        padding: `${SPACING.md}px`,
        background: COLORS.surfaceAlt,
        borderRadius: `${RADIUS.md}px`,
        border: `1px solid ${COLORS.surfaceBorder}`,
      }}>
      <CardTextBlock card={card} />
    </div>
  );
}

function SynergyBreakdownRow({
  group,
  isActive,
  isHovered,
  onMouseEnter,
  onMouseLeave,
  onClick,
}: {
  group: SynergyGroup;
  isActive: boolean;
  isHovered: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onClick: () => void;
}) {
  const tier = getStrengthTier(getDominantScore(group.synergies));
  const arrowColor = isActive || isHovered ? COLORS.primary500 : COLORS.textMuted;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={activateOnEnterOrSpace(onClick)}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '6px 8px',
        borderRadius: `${RADIUS.sm}px`,
        cursor: 'pointer',
        transition: 'background 0.15s',
        background: getRowBackground(isActive, isHovered),
      }}>
      {/* Count circle */}
      <TierCircle tier={tier} size="sm">
        {group.synergies.length}
      </TierCircle>

      {/* Label */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          fontSize: `${FONT_SIZES.base}px`,
          color: COLORS.text,
          fontWeight: 500,
          ...TRUNCATE,
        }}>
        {group.label}
      </div>

      {/* Arrow */}
      <span
        style={{
          fontSize: `${FONT_SIZES.xs}px`,
          color: arrowColor,
          transition: 'color 0.15s',
        }}>
        &rarr;
      </span>
    </div>
  );
}

function SynergyBreakdownBox({
  synergies,
  activeGroupKey,
  onGroupClick,
}: {
  synergies: SynergyGroup[];
  activeGroupKey: string | null | undefined;
  onGroupClick?: (groupKey: string) => void;
}) {
  const [hoveredGroup, setHoveredGroup] = useState<string | null>(null);
  return (
    <div
      data-testid="synergy-breakdown"
      style={{
        padding: `${SPACING.md}px`,
        background: COLORS.surfaceAlt,
        borderRadius: `${RADIUS.md}px`,
        border: `1px solid ${COLORS.surfaceBorder}`,
      }}>
      {/* Header */}
      <div
        style={{
          fontSize: `${FONT_SIZES.xs}px`,
          fontWeight: 600,
          color: COLORS.textMuted,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          marginBottom: 10,
        }}>
        Synergy Breakdown
      </div>

      {/* Rows */}
      <div style={{display: 'flex', flexDirection: 'column', gap: '2px'}}>
        {synergies.map((group) => (
          <SynergyBreakdownRow
            key={group.groupKey}
            group={group}
            isActive={activeGroupKey === group.groupKey}
            isHovered={hoveredGroup === group.groupKey}
            onMouseEnter={() => setHoveredGroup(group.groupKey)}
            onMouseLeave={() => setHoveredGroup(null)}
            onClick={() => onGroupClick?.(group.groupKey)}
          />
        ))}
      </div>
    </div>
  );
}

// ── Main panel ──

export function CardDetailPanel({
  card,
  synergies,
  onGroupClick,
  activeGroupKey,
}: CardDetailPanelProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);

  return (
    <article
      data-testid="card-detail-panel"
      style={{
        width: `${LAYOUT.cardDetailWidth}px`,
        minWidth: `${LAYOUT.cardDetailWidth}px`,
        borderRight: `1px solid ${COLORS.surfaceBorder}`,
        background: COLORS.surface,
        overflowY: 'auto',
        maxHeight: `calc(100vh - ${LAYOUT.compactHeaderHeight}px)`,
        display: 'flex',
        flexDirection: 'column',
        padding: `${SPACING.lg}px`,
        gap: `${SPACING.lg}px`,
        boxSizing: 'border-box',
      }}>
      <CardImageBox card={card} onOpenLightbox={() => setLightboxOpen(true)} />
      <CardLightboxGate
        card={card}
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
      />
      <CardTitleBlock card={card} />
      {hasCardText(card) && <CardTextBox card={card} />}
      {hasSynergyGroups(synergies) && (
        <SynergyBreakdownBox
          synergies={synergies}
          activeGroupKey={activeGroupKey}
          onGroupClick={onGroupClick}
        />
      )}
    </article>
  );
}
