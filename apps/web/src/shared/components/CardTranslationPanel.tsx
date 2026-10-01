import type {LorcanaCard} from 'inkweave-synergy-engine';
import {CAP_LABEL_XS, COLORS, FONT_SIZES, SPACING} from '../constants';
import {CardTextBlock} from './CardTextBlock';

/** Panel spacing and type sizes. */
const SIZES = {
  regular: {padding: SPACING.xxl, gap: SPACING.lg, name: FONT_SIZES.xxl, version: FONT_SIZES.lg, text: FONT_SIZES.lg, note: FONT_SIZES.md},
  compact: {padding: SPACING.lg, gap: SPACING.md, name: FONT_SIZES.xl, version: FONT_SIZES.base, text: FONT_SIZES.base, note: FONT_SIZES.xs},
} as const;

interface CardTranslationPanelProps {
  card: LorcanaCard;
  /** `compact` fits the mobile card modal's 240px card; `regular` fills a larger one. */
  size?: keyof typeof SIZES;
  /** Merged onto the panel, e.g. CardLightbox's absolute placement over the scan. */
  style?: React.CSSProperties;
}

/** The English name of a language code ("ja" → "Japanese"); the code itself if the runtime has none. */
function languageName(code: string): string {
  try {
    return new Intl.DisplayNames(['en'], {type: 'language'}).of(code) ?? code;
  } catch {
    return code;
  }
}

/**
 * The English name and rules text of a card whose only scan is in another language
 * (`card.scanLanguage`), labelled as the unofficial translation it is. CardLightbox and the
 * card modal lay it over the scan behind a CardTranslationToggle.
 */
export function CardTranslationPanel({card, size = "regular", style}: CardTranslationPanelProps) {
  const sizes = SIZES[size];
  const language = card.scanLanguage ? languageName(card.scanLanguage) : 'original';
  const hasText = !!(card.textSections?.length || card.text);

  return (
    <section
      aria-label={`English translation of ${card.fullName}`}
      data-testid="card-translation"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: sizes.gap,
        padding: sizes.padding,
        background: COLORS.surfaceOverlay,
        overflowY: 'auto',
        boxSizing: 'border-box',
        textAlign: 'left',
        // Hosts can sit it in a `lineHeight: 0` image wrapper (the card modal's).
        lineHeight: 1.4,
        ...style,
      }}>
      <span style={{...CAP_LABEL_XS, color: COLORS.primary}}>Unofficial translation</span>
      <h2
        style={{
          fontSize: `${sizes.name}px`,
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
              fontSize: `${sizes.version}px`,
              fontWeight: 400,
              color: COLORS.textMuted,
              marginTop: SPACING.xs,
            }}>
            {card.version}
          </span>
        )}
      </h2>
      {hasText ? (
        <CardTextBlock card={card} fontSize={sizes.text} />
      ) : (
        <p style={{margin: 0, fontSize: `${sizes.text}px`, color: COLORS.textMuted}}>
          This card has no rules text.
        </p>
      )}
      <p
        style={{
          margin: 0,
          marginTop: 'auto',
          fontSize: `${sizes.note}px`,
          lineHeight: 1.4,
          color: COLORS.textMuted,
        }}>
        Translated from the {language} card. The English card&apos;s wording may differ.
      </p>
    </section>
  );
}
