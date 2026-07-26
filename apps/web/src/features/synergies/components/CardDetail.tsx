import type {LorcanaCard} from '../../cards';
import {INK_COLORS, COLORS, FONT_SIZES, RADIUS, SPACING, LAYOUT} from '../../../shared/constants';
import {CardImage, CardTextBlock, InkIcon} from '../../../shared/components';

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

export function CardDetail({card, onClear, headingLevel = 'h2'}: CardDetailProps) {
  const inkColors = INK_COLORS[card.ink];
  const Heading = headingLevel;

  return (
    <article
      style={{
        background: COLORS.surface,
        borderRadius: `${RADIUS.xl}px`,
        padding: `${SPACING.xl}px`,
        marginBottom: `${SPACING.xl}px`,
        boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
        display: 'flex',
        gap: `${SPACING.xl}px`,
      }}>
      <CardImage
        src={card.imageUrl}
        alt={card.fullName}
        width={LAYOUT.selectedCardImageWidth}
        height={Math.round(LAYOUT.selectedCardImageWidth * 1.4)}
        inkColor={card.ink}
        cost={card.cost}
        lazy={false}
        borderRadius={RADIUS.lg}
      />
      <div style={{flex: 1}}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>
          <div>
            <Heading
              style={{
                fontSize: `${FONT_SIZES.xxl}px`,
                fontWeight: 700,
                color: COLORS.gray800,
                margin: 0,
              }}>
              {card.fullName}
            </Heading>
            <div
              style={{
                display: 'flex',
                gap: `${SPACING.sm}px`,
                marginTop: `${SPACING.sm}px`,
                flexWrap: 'wrap',
              }}>
              <span
                style={{
                  background: inkColors.bg,
                  color: inkColors.text,
                  padding: '4px 10px',
                  borderRadius: `${RADIUS.md}px`,
                  fontSize: `${FONT_SIZES.base}px`,
                  fontWeight: 500,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                }}>
                <InkIcon ink={card.ink} size={16} />
                {card.ink}
              </span>
              <span
                style={{
                  background: COLORS.gray100,
                  color: COLORS.gray700,
                  padding: '4px 10px',
                  borderRadius: `${RADIUS.md}px`,
                  fontSize: `${FONT_SIZES.base}px`,
                }}>
                Cost {card.cost}
              </span>
              {card.keywords?.map((k) => (
                <span
                  key={k}
                  style={{
                    background: COLORS.surfaceAlt,
                    color: COLORS.textMuted,
                    padding: '4px 10px',
                    borderRadius: `${RADIUS.md}px`,
                    fontSize: `${FONT_SIZES.base}px`,
                  }}>
                  {k}
                </span>
              ))}
            </div>
          </div>
          <button
            onClick={onClear}
            style={{
              background: COLORS.gray100,
              border: 'none',
              borderRadius: `${RADIUS.md}px`,
              padding: '8px 12px',
              cursor: 'pointer',
              fontSize: `${FONT_SIZES.base}px`,
              color: COLORS.gray700,
            }}>
            Clear
          </button>
        </div>
        {(card.textSections?.length || card.text) && (
          <div
            style={{
              marginTop: '12px',
              padding: '12px',
              background: COLORS.gray50,
              borderRadius: `${RADIUS.md}px`,
            }}>
            <CardTextBlock card={card} />
          </div>
        )}
      </div>
    </article>
  );
}
