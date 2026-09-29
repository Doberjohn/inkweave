import {useState, type CSSProperties, type KeyboardEvent} from 'react';
import {Link} from 'react-router-dom';
import type {LorcanaCard} from '../../cards';
import type {SynergyGroup} from '../types';
import {getDominantScore, getStrengthTier} from '../utils';
import {COLORS, FONT_SIZES, RADIUS, SPACING, LAYOUT, TRUNCATE, hexRgba} from '../../../shared/constants';
import {
  CardImage,
  CardImageButton,
  CardLightbox,
  CardTextBlock,
  PrintingCarousel,
  PrintingPills,
  TierCircle,
} from '../../../shared/components';
import {printingAlt, usePrintingSelection, type Printing} from '../../../shared/hooks';
import {trackEvent} from '../../../shared/lib/analytics';

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

const HERO_WIDTH = 298;
const HERO_HEIGHT = 417;

interface PrintingSelection {
  printings: Printing[];
  index: number;
  onSelect: (index: number) => void;
}

/**
 * The hero art of a card with an alternate printing (#625): the swipeable printings strip,
 * with the Standard | <rarity> pills under it. The page scrolls, so nothing here clips.
 */
function PrintingsHero({
  card,
  selection,
  onEnlarge,
}: {
  card: LorcanaCard;
  selection: PrintingSelection;
  onEnlarge: (index: number) => void;
}) {
  return (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: SPACING.sm}}>
      <PrintingCarousel
        key={card.id}
        card={card}
        printings={selection.printings}
        index={selection.index}
        onIndexChange={selection.onSelect}
        onEnlarge={onEnlarge}
        width={HERO_WIDTH}
        height={HERO_HEIGHT}
        borderRadius={RADIUS.xl}
        priority
      />
      <PrintingPills
        printings={selection.printings}
        index={selection.index}
        onSelect={selection.onSelect}
      />
    </div>
  );
}

function CardImageBox({card, onOpenLightbox}: {card: LorcanaCard; onOpenLightbox: () => void}) {
  const handleClick = () => {
    if (card.imageUrl) onOpenLightbox();
  };
  return (
    <div style={{display: 'flex', justifyContent: 'center'}}>
      <CardImageButton
        ariaLabel="Enlarge card image"
        onClick={handleClick}
        borderRadius={RADIUS.xl}
        enlargeable={!!card.imageUrl}>
        <CardImage
          src={card.imageUrl}
          alt={card.fullName}
          width={HERO_WIDTH}
          height={HERO_HEIGHT}
          inkColor={card.ink}
          cost={card.cost}
          lazy={false}
          priority
          borderRadius={RADIUS.xl}
        />
      </CardImageButton>
    </div>
  );
}

/**
 * The enlarged view of the printing that was clicked. Only the Standard printing carries the
 * card's own scan, so only it gets the "See translation" toggle (`card`); a variant's art is
 * an official English printing.
 */
function CardLightboxGate({
  card,
  printing,
  onClose,
}: {
  card: LorcanaCard;
  printing: Printing | null;
  onClose: () => void;
}) {
  if (!printing?.imageUrl) return null;
  return (
    <CardLightbox
      src={printing.imageUrl}
      alt={printingAlt(card, printing)}
      isLocation={card.type === 'Location'}
      card={printing.rarity ? undefined : card}
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
  // Which printing's lightbox is open (index into `printings`), or null when closed.
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const {printings, index, select} = usePrintingSelection(card);
  const selectPrinting = (next: number) => {
    select(next);
    const {rarity} = printings[next];
    if (rarity) trackEvent('card_printing_view', {cardId: card.id, rarity, surface: 'card_page'});
  };

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
      {printings.length > 1 ? (
        <PrintingsHero
          card={card}
          selection={{printings, index, onSelect: selectPrinting}}
          onEnlarge={setLightboxIndex}
        />
      ) : (
        <CardImageBox card={card} onOpenLightbox={() => setLightboxIndex(0)} />
      )}
      <CardLightboxGate
        card={card}
        printing={lightboxIndex === null ? null : (printings[lightboxIndex] ?? null)}
        onClose={() => setLightboxIndex(null)}
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
