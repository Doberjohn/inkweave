import type {CSSProperties} from 'react';
import Skeleton from 'react-loading-skeleton';
import type {LorcanaCard} from '../../cards';
import {
  INK_COLORS,
  COLORS,
  FONT_SIZES,
  RADIUS,
  SPACING,
  blackRgba,
} from '../../../shared/constants';
import {
  CardImage,
  CardTextBlock,
  IconButton,
  InkIcon,
  PrintingCarousel,
} from '../../../shared/components';
import {InkCardPlaceholder} from '../../../shared/components/InkCardPlaceholder';
import {usePrintingSelection} from '../../../shared/hooks';

/** The card at the size the card modal shows it on mobile (CardOverviewModal). */
const ART_WIDTH = 240;
const ART_HEIGHT = Math.round((ART_WIDTH * 368) / 264);
/** The name's line height, at FONT_SIZES.xxl: one line is 24 px. */
const NAME_LINE_HEIGHT = 1.2;
/** The × beside the name. */
const CLOSE_SIZE = 28;

const CHIP_STYLE = {
  padding: `${SPACING.xs}px ${SPACING.md}px`,
  borderRadius: `${RADIUS.md}px`,
  fontSize: `${FONT_SIZES.base}px`,
} as const;

// The block's boxes, shared with its loading state (`CardDetailLoading`, #914).
const ARTICLE_STYLE: CSSProperties = {
  background: COLORS.surface,
  borderRadius: `${RADIUS.xl}px`,
  padding: `${SPACING.xl}px`,
  marginBottom: `${SPACING.xl}px`,
  boxShadow: `0 1px 3px ${blackRgba(0.3)}`,
  display: 'flex',
  flexDirection: 'column',
  gap: `${SPACING.lg}px`,
};
const HEADER_STYLE: CSSProperties = {display: 'flex', alignItems: 'flex-start', gap: SPACING.md};
const CHIPS_STYLE: CSSProperties = {display: 'flex', gap: `${SPACING.sm}px`, flexWrap: 'wrap'};
const ART_ROW_STYLE: CSSProperties = {display: 'flex', justifyContent: 'center'};
const TEXT_BOX_STYLE: CSSProperties = {
  padding: SPACING.md,
  background: COLORS.gray50,
  borderRadius: `${RADIUS.md}px`,
};

interface CardDetailProps {
  card: LorcanaCard;
  onClear: () => void;
  /**
   * Heading level for the card name. Defaults to `h2`, which is correct inside the
   * synergy modal — that dialog is not the document's primary subject.
   *
   * On the mobile card page this must be `h1` (#524): CardPage renders the desktop
   * `CardDetailPanel` (which owns the real `<h1>`) only when `!isMobile`, so below
   * that breakpoint the page shipped no `<h1>` at all. Googlebot renders mobile, so
   * that is the version of all 1,024 card pages Google actually indexes.
   */
  headingLevel?: 'h1' | 'h2';
}

/** The card name with the × that leaves the card, laid out like the card modal's header. */
function CardDetailHeader({
  card,
  onClear,
  headingLevel,
}: {
  card: LorcanaCard;
  onClear: () => void;
  headingLevel: 'h1' | 'h2';
}) {
  const Heading = headingLevel;
  return (
    <div style={HEADER_STYLE}>
      <Heading
        style={{
          flex: 1,
          minWidth: 0,
          margin: 0,
          fontSize: `${FONT_SIZES.xxl}px`,
          fontWeight: 700,
          lineHeight: NAME_LINE_HEIGHT,
          color: COLORS.text,
        }}>
        {card.fullName}
      </Heading>
      <IconButton
        aria-label="Close"
        onClick={onClear}
        size={CLOSE_SIZE}
        style={{
          borderRadius: RADIUS.pill,
          border: `1px solid ${COLORS.surfaceBorder}`,
          fontSize: FONT_SIZES.xl,
          flexShrink: 0,
        }}>
        ×
      </IconButton>
    </div>
  );
}

/** Ink, cost and keywords. */
function CardDetailChips({card}: {card: LorcanaCard}) {
  const inkColors = INK_COLORS[card.ink];
  return (
    <div style={CHIPS_STYLE}>
      <span
        style={{
          ...CHIP_STYLE,
          background: inkColors.bg,
          color: inkColors.text,
          fontWeight: 500,
          display: 'inline-flex',
          alignItems: 'center',
          gap: SPACING.xs,
        }}>
        <InkIcon ink={card.ink} size={16} />
        {card.ink}
      </span>
      <span style={{...CHIP_STYLE, background: COLORS.gray100, color: COLORS.gray700}}>
        Cost {card.cost}
      </span>
      {card.keywords?.map((k) => (
        <span
          key={k}
          style={{...CHIP_STYLE, background: COLORS.surfaceAlt, color: COLORS.textMuted}}>
          {k}
        </span>
      ))}
    </div>
  );
}

/**
 * The card art, centered. A card with an alternate printing (#625) stands in front of its other
 * printings, turned by a swipe that throws it aside or a tap on the edges of the printings behind
 * it (owner, 2026-10-22: the pills under it went).
 */
function CardDetailArt({card}: {card: LorcanaCard}) {
  const {printings, index, select, settle} = usePrintingSelection(card, {
    surface: 'card_page',
  });

  return (
    <div style={ART_ROW_STYLE}>
      {printings.length < 2 ? (
        <CardImage
          src={card.imageUrl}
          alt={card.fullName}
          width={ART_WIDTH}
          height={ART_HEIGHT}
          inkColor={card.ink}
          inkColor2={card.ink2}
          cost={card.cost}
          lazy={false}
          priority
          borderRadius={RADIUS.lg}
        />
      ) : (
        <PrintingCarousel
          key={card.id}
          card={card}
          printings={printings}
          index={index}
          onIndexChange={select}
          onSettle={settle}
          width={ART_WIDTH}
          height={ART_HEIGHT}
          borderRadius={RADIUS.lg}
          priority
        />
      )}
    </div>
  );
}

/**
 * The card on the mobile card page, read top to bottom in the card modal's order: name and
 * ×, details, the card with its printings, then its text.
 */
export function CardDetail({card, onClear, headingLevel = 'h2'}: CardDetailProps) {
  return (
    <article style={ARTICLE_STYLE}>
      <CardDetailHeader card={card} onClear={onClear} headingLevel={headingLevel} />
      <CardDetailChips card={card} />
      <CardDetailArt card={card} />
      {(card.textSections?.length || card.text) && (
        <div style={TEXT_BOX_STYLE}>
          <CardTextBlock card={card} />
        </div>
      )}
    </article>
  );
}

/** A chip's height: its text's line (13 px at the body's 1.5) and its padding. */
const CHIP_HEIGHT = FONT_SIZES.base * 1.5 + SPACING.xs * 2;
/** An ink chip with its icon and a "Cost N" chip, as most cards' row starts. */
const CHIP_WIDTHS = [104, 64];
const TEXT_LINES = 4;

/** One placeholder exactly its box: no line box around it (`inline`, then drawn as a block). */
function Block({width, height, radius = RADIUS.sm}: {width?: number | string; height: number; radius?: number}) {
  return <Skeleton inline width={width} height={height} borderRadius={radius} style={{display: 'block'}} />;
}

/**
 * CardDetail while the card list loads (#914): its frame and boxes, so the card lands where its
 * placeholder was. The name takes one line, as 803 of the 1,228 card names do at 390 px; a
 * longer name lands the art one line lower.
 */
export function CardDetailLoading() {
  return (
    <div style={ARTICLE_STYLE}>
      <div style={HEADER_STYLE}>
        {/* One line of the name, its bar centered in the line. */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            height: FONT_SIZES.xxl * NAME_LINE_HEIGHT,
            paddingTop: SPACING.xxs,
          }}>
          <Block width="70%" height={FONT_SIZES.xxl} />
        </div>
        <Block width={CLOSE_SIZE} height={CLOSE_SIZE} radius={RADIUS.pill} />
      </div>
      <div style={CHIPS_STYLE}>
        {CHIP_WIDTHS.map((width) => (
          <Block key={width} width={width} height={CHIP_HEIGHT} radius={RADIUS.md} />
        ))}
      </div>
      <div style={ART_ROW_STYLE}>
        {/* The card is not known yet, so the tile is the neutral one. */}
        <div
          style={{
            position: 'relative',
            width: ART_WIDTH,
            height: ART_HEIGHT,
            borderRadius: RADIUS.lg,
            overflow: 'hidden',
          }}>
          <InkCardPlaceholder />
        </div>
      </div>
      <div style={{...TEXT_BOX_STYLE, display: 'flex', flexDirection: 'column', gap: SPACING.sm}}>
        {Array.from({length: TEXT_LINES}, (_, i) => (
          <Block key={i} width={i === TEXT_LINES - 1 ? '60%' : '100%'} height={12} />
        ))}
      </div>
    </div>
  );
}
