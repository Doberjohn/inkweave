import {useEffect, type CSSProperties} from 'react';
import {CtaButton} from '../../../shared/components';
import {COLORS, FONT_SIZES, LINE_HEIGHT, SPACING, TABULAR} from '../../../shared/constants';
import type {SaveOffer} from './binderChoices';
import {cardCount} from './shelfWords';

/** Starts the box's chunk once the button shows, so its press never waits on a download. */
const preloadBox = () => {
  import('./SaveAsBinder').catch(() => {});
};

const FOOT: CSSProperties = {display: 'flex', flexDirection: 'column', gap: SPACING.xs};

const BUTTON: CSSProperties = {width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm};

const LINE: CSSProperties = {
  ...TABULAR,
  margin: 0,
  fontSize: `${FONT_SIZES.sm}px`,
  lineHeight: LINE_HEIGHT.base,
  color: COLORS.textMuted,
};

/** A binder's spine and rings, as the button's glyph. */
function BinderGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="5" y="3" width="14" height="18" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M9 3v18" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3.5 8h3M3.5 12h3M3.5 16h3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

interface SaveAsBinderFootProps {
  offer: SaveOffer;
  onPress: () => void;
}

/**
 * Save as a binder, at the foot of the filters: a gold-outlined button, and under it what it would
 * keep, "Keeps Amber ink as a binder of its own: 625 cards". Only drawn while the page has an
 * offer (`saveOffer`), so it never shows empty.
 */
export function SaveAsBinderFoot({offer, onPress}: SaveAsBinderFootProps) {
  useEffect(preloadBox, []);
  return (
    <div style={FOOT}>
      <CtaButton variant="ghost" onClick={onPress} style={BUTTON}>
        <BinderGlyph />
        Save as a binder
      </CtaButton>
      <p style={LINE}>{`Keeps ${offer.line} as a binder of its own: ${cardCount(offer.figures.cards, offer.scope)}`}</p>
    </div>
  );
}
