import type {CSSProperties, RefObject} from 'react';
import {COLORS, FONT_SIZES, FONT_WEIGHT, LINE_HEIGHT, SPACING} from '../../../shared/constants';
import {LoadFailedNotice} from './LoadFailedNotice';

/** A notice in place of a card's synergies, centered in the column it takes. */
const NOTICE_STYLE: CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center',
  padding: SPACING.xxl,
  gap: SPACING.sm,
};

const TITLE_STYLE: CSSProperties = {
  margin: 0,
  color: COLORS.text,
  fontSize: FONT_SIZES.lg,
  fontWeight: FONT_WEIGHT.semibold,
};

const BODY_STYLE: CSSProperties = {
  margin: 0,
  color: COLORS.textMuted,
  fontSize: FONT_SIZES.md,
  lineHeight: LINE_HEIGHT.base,
};

function Notice({testId, title, body, bodyWidth}: {testId: string; title: string; body: string; bodyWidth: number}) {
  return (
    <div data-testid={testId} style={NOTICE_STYLE}>
      <p style={TITLE_STYLE}>{title}</p>
      <p style={{...BODY_STYLE, maxWidth: bodyWidth}}>{body}</p>
    </div>
  );
}

/**
 * In place of synergies for a card from sets 1-8. Collection mode
 * shows every card a collection can hold, but Inkweave analyses Core only, so the
 * honest answer is "not analysed", not "none found".
 */
export function OutsideCoreNotice() {
  return (
    <Notice
      testId="card-overview-outside-core"
      title="Outside Core"
      body="Inkweave analyses the Core format, sets 9 and later, so this card has no synergies here."
      bodyWidth={300}
    />
  );
}

export function SynergiesEmptyState() {
  return (
    <Notice
      testId="card-overview-empty"
      title="No synergies yet"
      body="This card may match new rules as the engine evolves."
      bodyWidth={280}
    />
  );
}

interface SynergiesFailedNoticeProps {
  onRetry: () => void;
  /** The column around the notice, which holds focus through the retry (`LoadFailedNotice`). */
  focusOnRetry: RefObject<HTMLElement | null>;
}

/**
 * In place of a card's synergies when its synergy file failed to load: never "no synergies",
 * which only a card with no file has.
 */
export function SynergiesFailedNotice({onRetry, focusOnRetry}: SynergiesFailedNoticeProps) {
  return (
    <LoadFailedNotice
      what="this card's synergies"
      layout="stacked"
      testId="synergies-failed"
      onRetry={onRetry}
      focusOnRetry={focusOnRetry}
    />
  );
}
