import type {LorcanaCard} from 'inkweave-synergy-engine';
import {CAP_LABEL_XS, COLORS, FONT_SIZES, SPACING} from '../tokens/theme';
import {CardTextBlock} from './CardTextBlock';

/** Panel spacing and type sizes. */
const SIZES = {
  regular: {padding: SPACING.xxl, gap: SPACING.lg, name: FONT_SIZES.xxl, version: FONT_SIZES.lg, text: FONT_SIZES.lg, note: FONT_SIZES.md},
  compact: {padding: SPACING.lg, gap: SPACING.md, name: FONT_SIZES.xl, version: FONT_SIZES.base, text: FONT_SIZES.base, note: FONT_SIZES.xs},
} as const;

interface CardTranslationPanelProps {
  card: LorcanaCard;
  /** The translated scan's language: a variant printing's (#681), by default the card's own. */
  language?: string;
  /** `compact` fits the mobile card modal's 240px card; `regular` fills a larger one. */
  size?: keyof typeof SIZES;
  /** Merged onto the panel, e.g. CardLightbox's absolute placement over the scan. */
  style?: React.CSSProperties;
}

/**
 * Whether the English text over a scan in `language` is the card's official text: the card's
 * own scan is English, or the card is a printing's (it has a `baseId`), whose text is the
 * English card's. Only a card whose own scan is foreign has no more than a translation.
 */
function isOfficialText(card: LorcanaCard, language: string | undefined): boolean {
  if (!language) return false;
  return !card.scanLanguage || card.baseId !== undefined;
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
 * The English name and rules text of a card shown in another language's scan, its own or a
 * variant printing's (#681; variants are rules-identical, so the card's text serves). A card
 * whose own scan is foreign has only an unofficial translation, and says so. A card whose own
 * scan is English, shown in a variant revealed abroad first, has its official English text. So
 * does a printing's own card (one with a `baseId`), whose scan is its printing's and whose text
 * is the English card's: the binder's pocket for a pre-Core card's promo, 41/P1 in Japanese
 * (#805). CardLightbox and the card modal lay it over the scan behind a CardTranslationToggle.
 */
export function CardTranslationPanel({
  card,
  language: languageProp,
  size = 'regular',
  style,
}: CardTranslationPanelProps) {
  // Defaulted here rather than in the parameters: React Compiler can't compile a parameter
  // default that reads another prop, and the package's lint fails on a component it skips.
  const language = languageProp ?? card.scanLanguage;
  const sizes = SIZES[size];
  const languageLabel = language ? languageName(language) : 'original';
  const hasText = !!(card.textSections?.length || card.text);
  const official = isOfficialText(card, language);

  return (
    <section
      aria-label={`English ${official ? 'text' : 'translation'} of ${card.fullName}`}
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
      <span style={{...CAP_LABEL_XS, color: COLORS.primary}}>
        {official ? 'English text' : 'Unofficial translation'}
      </span>
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
        {official
          ? `This printing is in ${languageLabel}. The text is the English card's.`
          : `Translated from the ${languageLabel} card. The English card's wording may differ.`}
      </p>
    </section>
  );
}
