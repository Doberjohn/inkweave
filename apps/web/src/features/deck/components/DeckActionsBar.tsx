import {useState} from 'react';
import {CtaButton} from '../../../shared/components';
import {FONT_SIZES, SPACING} from '../../../shared/constants';

/** Compact toolbar buttons: icon + label, quiet until hovered. */
const ACTION_STYLE = {minHeight: 32, padding: `0 ${SPACING.md}px`, fontSize: FONT_SIZES.md, gap: 6} as const;

function ClearIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ImportIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 15V3m0 0L8 7m4-4 4 4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ExportIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="9" y="9" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

interface DeckActionsBarProps {
  /** Empties the deck. */
  onClear: () => void;
  onImport: () => void;
  /** Opens the deck in Duels.ink; omitted/disabled while the deck is empty. */
  onExport: () => void;
  /** Drives the clear confirmation and disables export on an empty deck. */
  cardCount: number;
}

/**
 * Deck toolbar (#473): Clear / Import / Export above the deck list. Clear is a
 * two-step confirm when the deck has cards — the deck is a working draft with no
 * undo, so a stray click must not wipe it. Save arrives with account decks.
 */
export function DeckActionsBar({onClear, onImport, onExport, cardCount}: DeckActionsBarProps) {
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

      <CtaButton variant="neutral" onClick={onImport} style={ACTION_STYLE}>
        <ImportIcon />
        Import
      </CtaButton>

      <CtaButton variant="neutral" onClick={onExport} disabled={isEmpty} style={ACTION_STYLE}>
        <ExportIcon />
        Export
      </CtaButton>
    </div>
  );
}
