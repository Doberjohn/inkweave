import {useState} from 'react';
import {CtaButton} from '../../../shared/components';
import {SPACING} from '../../../shared/constants';

/**
 * Compact toolbar buttons: icon + label, quiet until hovered. Height and padding
 * stay pinned so the bar keeps its tight rhythm, but the font size is deliberately
 * NOT overridden — it inherits the kit's 14/600 (2026-07-31 legibility ruling).
 * Pinning it here is exactly what left this bar at 12px while every other button
 * in the app moved to 14px.
 */
const ACTION_STYLE = {minHeight: 32, padding: `0 ${SPACING.md}px`, gap: 6} as const;

function ClearIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Arrow DOWN into the tray: data arriving. The mirrored arrow-up is upload/share. */
function ImportIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3v12m0 0L8 11m4 4 4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Box with an arrow escaping it: the convention for "this leaves the site". */
function ExternalLinkIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M14 4h6v6M20 4l-8.5 8.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/** Shown as title + aria-label on the disabled Duels button, per the QuantityStepper convention. */
const ILLEGAL_REASON = 'Deck must be Core legal to play on Duels';

interface DeckActionsBarProps {
  /** Empties the deck. */
  onClear: () => void;
  onImport: () => void;
  /** Opens the deck in Duels.ink; disabled until the deck is Core legal. */
  onExport: () => void;
  /** Drives the clear confirmation and disables Clear on an empty deck. */
  cardCount: number;
  /** `DeckStats.isLegal` — Tier-1 hard rules (size / copies / inks). Gates export. */
  isLegal: boolean;
}

/**
 * Deck toolbar (#473): Clear / Import / Play on Duels above the deck list. Clear is a
 * two-step confirm when the deck has cards — the deck is a working draft with no
 * undo, so a stray click must not wipe it. Save arrives with account decks.
 */
export function DeckActionsBar({onClear, onImport, onExport, cardCount, isLegal}: DeckActionsBarProps) {
  const [confirmingClear, setConfirmingClear] = useState(false);
  const isEmpty = cardCount === 0;

  const clearNow = () => {
    onClear();
    setConfirmingClear(false);
  };

  return (
    <div style={{display: 'flex', gap: SPACING.sm, flexWrap: 'wrap'}}>
      {confirmingClear ? (
        <>
          <CtaButton onClick={clearNow} style={ACTION_STYLE} aria-label={`Clear all ${cardCount} cards`}>
            Clear {cardCount} cards?
          </CtaButton>
          <CtaButton variant="neutral" onClick={() => setConfirmingClear(false)} style={ACTION_STYLE}>
            Keep
          </CtaButton>
        </>
      ) : (
        <CtaButton
          variant="neutral"
          onClick={() => (isEmpty ? undefined : setConfirmingClear(true))}
          disabled={isEmpty}
          style={ACTION_STYLE}>
          <ClearIcon />
          Clear
        </CtaButton>
      )}

      {/*
        Ghost, not neutral: only the destructive Clear stays neutral, so the
        quietest button in the bar is the one with no undo.
      */}
      <CtaButton variant="ghost" onClick={onImport} style={ACTION_STYLE}>
        <ImportIcon />
        Import
      </CtaButton>

      {/*
        Filled — the bar's payoff, and the only action that leaves the app. Gated
        on isLegal rather than card count: a deck that breaks the copy or ink
        rules would be rejected on the far side anyway, so the block belongs here
        where we can say why. LegalityErrors stays silent about a mere shortfall
        (it filters "(minimum 60)"), so the disabled reason carries that alone.
      */}
      <CtaButton
        variant="filled"
        onClick={onExport}
        disabled={!isLegal}
        title={isLegal ? undefined : ILLEGAL_REASON}
        aria-label={isLegal ? undefined : ILLEGAL_REASON}
        style={ACTION_STYLE}>
        <ExternalLinkIcon />
        Play on Duels
      </CtaButton>
    </div>
  );
}
