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
  TierCircle,
} from '../../../shared/components';
import {printingAlt, usePrintingSelection, type Printing} from '../../../shared/hooks';

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
/** The panel's padding, between its edge and the hero: the room the printings behind the hero show in. */
const PANEL_PADDING = SPACING.lg;

type PrintingSelection = ReturnType<typeof usePrintingSelection>;

/**
 * The hero art of a card with an alternate printing (#625): the card in front of its other
 * printings, turned by a throw, a swipe, the peeks at its sides or ← → (owner, 2026-10-22: the
 * pills under it went). The panel scrolls, so it clips at its edge: the printings behind the
 * card show in its padding.
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
    <div style={{display: 'flex', justifyContent: 'center'}}>
      <PrintingCarousel
        key={card.id}
        card={card}
        printings={selection.printings}
        index={selection.index}
        onIndexChange={selection.select}
        onSettle={selection.settle}
        onEnlarge={onEnlarge}
        width={HERO_WIDTH}
        height={HERO_HEIGHT}
        borderRadius={RADIUS.xl}
        priority
        room={PANEL_PADDING}
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
 * The enlarged view of the printing that was clicked. Only a printing whose scan is not in
 * English gets the "See translation" toggle (`card`): the card's own scan on Standard, or a
 * variant revealed abroad first (#681).
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
      card={printing.scanLanguage ? card : undefined}
      language={printing.scanLanguage}
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
        the same two lines as before; only the semantics changed. The space before the span
        never shows, since it falls at a line break, but it keeps the heading's text
        "Name Version" rather than "NameVersion" for crawlers reading the HTML.
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
          <>
            {' '}
            <span
              style={{
                display: 'block',
                fontSize: `${FONT_SIZES.base}px`,
                fontWeight: 400,
                color: COLORS.textMuted,
                marginTop: SPACING.xs,
              }}>
              {card.version}
            </span>
          </>
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
        All {card.name} cards <span aria-hidden="true">→</span>
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
        gap: SPACING.md,
        padding: `${SPACING.xs}px ${SPACING.sm}px`,
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

      {/* Arrow, drawn but not read: the row's name is its count and label. */}
      <span
        aria-hidden="true"
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
          marginBottom: SPACING.md,
        }}>
        Synergy Breakdown
      </div>

      {/* Rows */}
      <div style={{display: 'flex', flexDirection: 'column', gap: SPACING.xxs}}>
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

/**
 * Which printing's lightbox is open (an index into the card's printings), or null. Tied to the
 * card: the card page stays mounted across /card/:id navigations, so a browser Back taken with
 * the lightbox open closes it instead of carrying the index over to the next card. Same
 * render-time reset as usePrintingSelection.
 */
function useCardLightbox(cardId: string) {
  const [shown, setShown] = useState<{cardId: string; index: number} | null>(null);
  if (shown && shown.cardId !== cardId) setShown(null);
  return {
    index: shown?.cardId === cardId ? shown.index : null,
    open: (index: number) => setShown({cardId, index}),
    close: () => setShown(null),
  };
}

// ── Main panel ──

export function CardDetailPanel({
  card,
  synergies,
  onGroupClick,
  activeGroupKey,
}: CardDetailPanelProps) {
  const lightbox = useCardLightbox(card.id);
  const selection = usePrintingSelection(card, {surface: 'card_page'});
  const {printings} = selection;

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
        padding: `${PANEL_PADDING}px`,
        gap: `${SPACING.lg}px`,
        boxSizing: 'border-box',
      }}>
      {printings.length > 1 ? (
        <PrintingsHero card={card} selection={selection} onEnlarge={lightbox.open} />
      ) : (
        <CardImageBox card={card} onOpenLightbox={() => lightbox.open(0)} />
      )}
      <CardLightboxGate
        card={card}
        printing={lightbox.index === null ? null : (printings[lightbox.index] ?? null)}
        onClose={lightbox.close}
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
