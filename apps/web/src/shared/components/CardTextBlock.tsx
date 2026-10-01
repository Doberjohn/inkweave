import type {LorcanaCard} from 'inkweave-synergy-engine';
import {COLORS, FONT_SIZES, SPACING} from '../constants';

interface CardTextBlockProps {
  card: LorcanaCard;
  /** Defaults to FONT_SIZES.sm, the card-detail sidebar size. */
  fontSize?: number;
}

/**
 * Leading ALL-CAPS ability name, e.g. "COMMUNITY SERVICE" in "COMMUNITY SERVICE At the end of
 * your turn, ..." or "TAKE… YOUR… TIME". The name ends at the first point where the effect
 * starts: a capitalized word ("At"), a one-letter word opening a sentence ("A Princess ...",
 * "A character ..."), or an activated cost ("⟳", "6 ⬡", "—"). The match is lazy, so that first
 * boundary wins and "CIVIC DUTY 6 ⬡ — ..." stops before the cost's digit. The leading lookahead
 * needs two adjacent capitals before the first lowercase letter, so plain text opening on "A" or
 * "I" is never read as a name.
 */
const ABILITY_NAME =
  /^(?=[^a-z]*[A-Z]{2})[.…'‘’]*[A-Z][A-Z0-9 .…'‘’!?,&-]*?(?=\s+(?:[A-Z][a-z]|[AI] [A-Z]?[a-z]|[⟳⬡—]|\d+\s*⬡))/;

/** Formats a single ability text: bolds leading ALL-CAPS names, italicizes parenthesized reminders. */
function formatSection(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;

  const abilityName = ABILITY_NAME.exec(text)?.[0];
  if (abilityName) {
    // The margin widens the word gap after the name; at small sizes a bare space between bold
    // capitals and the effect's first word reads as one run ("SERVICEAt").
    parts.push(
      <span key="ability" style={{fontWeight: 700, marginRight: SPACING.xxs}}>
        {abilityName}
      </span>,
    );
    lastIndex = abilityName.length;
  }

  // Find parenthesized reminder text in the remainder
  const remainder = text.slice(lastIndex);
  const reminderPattern = /\(([^)]+)\)/g;
  let match;
  let remLastIndex = 0;

  while ((match = reminderPattern.exec(remainder)) !== null) {
    if (match.index > remLastIndex) {
      parts.push(remainder.slice(remLastIndex, match.index));
    }
    parts.push(
      <span key={`rem-${match.index}`} style={{fontStyle: 'italic', color: COLORS.textMuted}}>
        {match[0]}
      </span>,
    );
    remLastIndex = match.index + match[0].length;
  }

  if (remLastIndex < remainder.length) {
    parts.push(remainder.slice(remLastIndex));
  }

  return parts.length > 0 ? parts : text;
}

/** Renders card ability text with visual separation between sections. */
export function CardTextBlock({card, fontSize = FONT_SIZES.sm}: CardTextBlockProps) {
  const sections = card.textSections;
  const fallbackText = card.text;

  if (!sections?.length && !fallbackText) return null;

  const textBlocks = sections?.length ? sections : [fallbackText!];

  return (
    <div data-testid="card-text-block">
      {textBlocks.map((section, i) => {
        const divided = i < textBlocks.length - 1;
        // One shorthand each, never `margin: 0` plus a marginBottom: paragraphs are keyed by
        // position, and when a card with fewer sections makes this one the last, React would
        // unset that longhand instead of zeroing it, restoring the browser's 1em margin.
        const spacing = divided ? `0 0 ${SPACING.sm}px` : 0;
        return (
          <p
            key={i}
            style={{
              margin: spacing,
              padding: spacing,
              fontSize,
              lineHeight: 1.5,
              color: COLORS.text,
              borderBottom: divided ? `1px solid ${COLORS.surfaceBorder}` : undefined,
            }}>
            {formatSection(section)}
          </p>
        );
      })}
    </div>
  );
}
