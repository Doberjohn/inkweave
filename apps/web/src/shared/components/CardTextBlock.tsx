import type {LorcanaCard} from 'inkweave-synergy-engine';
import {COLORS, FONT_SIZES, SPACING} from '../constants';

interface CardTextBlockProps {
  card: LorcanaCard;
}

/** Formats a single ability text: bolds leading ALL-CAPS names, italicizes parenthesized reminders. */
function formatSection(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;

  // Extract leading ALL-CAPS ability name (e.g. "FREEZE ↷ — " or "A WONDERFUL DREAM ↷ — ")
  const abilityMatch = text.match(/^([A-Z][A-Z ']+(?:\s*[↷⬡]+)?(?:\s*—\s*))/);
  if (abilityMatch) {
    parts.push(
      <span key="ability" style={{fontWeight: 700}}>
        {abilityMatch[1]}
      </span>,
    );
    lastIndex = abilityMatch[1].length;
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
export function CardTextBlock({card}: CardTextBlockProps) {
  const sections = card.textSections;
  const fallbackText = card.text;

  if (!sections?.length && !fallbackText) return null;

  const textBlocks = sections?.length ? sections : [fallbackText!];

  return (
    <div data-testid="card-text-block">
      {textBlocks.map((section, i) => (
        <p
          key={i}
          style={{
            margin: 0,
            padding: 0,
            fontSize: FONT_SIZES.sm,
            lineHeight: 1.5,
            color: COLORS.text,
            ...(i < textBlocks.length - 1
              ? {
                  marginBottom: SPACING.sm,
                  paddingBottom: SPACING.sm,
                  borderBottom: `1px solid ${COLORS.surfaceBorder}`,
                }
              : {}),
          }}>
          {formatSection(section)}
        </p>
      ))}
    </div>
  );
}
