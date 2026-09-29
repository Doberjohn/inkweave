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
  PrintingPills,
} from '../../../shared/components';
import {usePrintingSelection} from '../../../shared/hooks';
import {trackEvent} from '../../../shared/lib/analytics';

/** The card at the size the card modal shows it on mobile (CardOverviewModal). */
const ART_WIDTH = 240;
const ART_HEIGHT = Math.round((ART_WIDTH * 368) / 264);

const CHIP_STYLE = {
  padding: '4px 10px',
  borderRadius: `${RADIUS.md}px`,
  fontSize: `${FONT_SIZES.base}px`,
} as const;

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
    <div style={{display: 'flex', alignItems: 'flex-start', gap: SPACING.md}}>
      <Heading
        style={{
          flex: 1,
          minWidth: 0,
          margin: 0,
          fontSize: `${FONT_SIZES.xxl}px`,
          fontWeight: 700,
          lineHeight: 1.2,
          color: COLORS.text,
        }}>
        {card.fullName}
      </Heading>
      <IconButton
        aria-label="Close"
        onClick={onClear}
        size={28}
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
    <div style={{display: 'flex', gap: `${SPACING.sm}px`, flexWrap: 'wrap'}}>
      <span
        style={{
          ...CHIP_STYLE,
          background: inkColors.bg,
          color: inkColors.text,
          fontWeight: 500,
          display: 'inline-flex',
          alignItems: 'center',
          gap: '5px',
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
 * The card art, centered. A card with an alternate printing (#625) gets the swipeable
 * printings strip with the Standard | <rarity> pills under it.
 */
function CardDetailArt({card}: {card: LorcanaCard}) {
  const {printings, index, select} = usePrintingSelection(card);
  const selectPrinting = (next: number) => {
    select(next);
    const {rarity} = printings[next];
    if (rarity) trackEvent('card_printing_view', {cardId: card.id, rarity, surface: 'card_page'});
  };

  return (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: SPACING.sm}}>
      {printings.length < 2 ? (
        <CardImage
          src={card.imageUrl}
          alt={card.fullName}
          width={ART_WIDTH}
          height={ART_HEIGHT}
          inkColor={card.ink}
          cost={card.cost}
          lazy={false}
          priority
          borderRadius={RADIUS.lg}
        />
      ) : (
        <>
          <PrintingCarousel
            key={card.id}
            card={card}
            printings={printings}
            index={index}
            onIndexChange={selectPrinting}
            width={ART_WIDTH}
            height={ART_HEIGHT}
            borderRadius={RADIUS.lg}
            priority
          />
          <PrintingPills printings={printings} index={index} onSelect={selectPrinting} isMobile />
        </>
      )}
    </div>
  );
}

/**
 * The card on the mobile card page, read top to bottom in the card modal's order: name and
 * ×, details, the card, its printings, then its text.
 */
export function CardDetail({card, onClear, headingLevel = 'h2'}: CardDetailProps) {
  return (
    <article
      style={{
        background: COLORS.surface,
        borderRadius: `${RADIUS.xl}px`,
        padding: `${SPACING.xl}px`,
        marginBottom: `${SPACING.xl}px`,
        boxShadow: `0 1px 3px ${blackRgba(0.3)}`,
        display: 'flex',
        flexDirection: 'column',
        gap: `${SPACING.lg}px`,
      }}>
      <CardDetailHeader card={card} onClear={onClear} headingLevel={headingLevel} />
      <CardDetailChips card={card} />
      <CardDetailArt card={card} />
      {(card.textSections?.length || card.text) && (
        <div style={{padding: '12px', background: COLORS.gray50, borderRadius: `${RADIUS.md}px`}}>
          <CardTextBlock card={card} />
        </div>
      )}
    </article>
  );
}
