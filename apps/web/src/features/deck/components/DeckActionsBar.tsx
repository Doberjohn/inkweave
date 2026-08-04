import {useState} from 'react';
import {CtaButton} from '../../../shared/components';
import {SPACING} from '../../../shared/constants';
import type {SaveState} from '../hooks/useDeckSave';

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

/**
 * A floppy disk: the one glyph that still reads unambiguously as "save" to
 * everyone, long after the hardware went away. The previous mirrored-arrow icon
 * said "upload", which is a different promise — this writes to your account, it
 * does not hand the deck to anywhere else.
 */
function SaveIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 3h11l3 3v15a0 0 0 0 1 0 0H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M8 3v6h7V3" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M7 21v-7h10v7" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
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

/**
 * The one thing this must do is stop the user reaching for their notes app. A
 * failed cloud save costs them nothing: the deck they can see is the one that
 * auto-persists locally, and the attempt never touched it.
 */
const SAVE_FAILED =
  'Could not reach your account. Nothing was lost: the deck is still saved on this device, exactly as you left it. Try again in a moment.';

/** Shown on the disabled Save, matching how the disabled Duels button explains itself. */
const NOTHING_TO_SAVE = 'No changes to save';

/**
 * Save's transient states, in words, because words survive a screen reader.
 * The resting label is always "Save" (owner ruling 2026-08-02): unsaved work is
 * signalled by whether the button is LIVE, not by rewording it.
 */
function saveLabel(saveState: SaveState): string {
  if (saveState === 'saving') return 'Saving…';
  if (saveState === 'error') return 'Save failed, retry';
  return 'Save';
}

/**
 * Why Save is inert, or the failure reason, following the QuantityStepper
 * convention: a disabled button's `title` is not reliably announced, so the same
 * string rides `aria-label` too. Returns undefined when the button is live and
 * needs no explanation.
 */
function saveDisabledReason(saveState: SaveState, isDirty: boolean): string | undefined {
  if (saveState === 'error') return SAVE_FAILED;
  if (saveState === 'idle' && !isDirty) return NOTHING_TO_SAVE;
  return undefined;
}

interface DeckActionsBarProps {
  /** Empties the deck. */
  onClear: () => void;
  onImport: () => void;
  /** Opens the save dialog: the cloud copy, which never changes on its own. */
  onSave: () => void;
  /** Opens the deck in Duels.ink; disabled until the deck is Core legal. */
  onExport: () => void;
  /** Drives the clear confirmation and disables Clear on an empty deck. */
  cardCount: number;
  /** `DeckStats.isLegal` — Tier-1 hard rules (size / copies / inks). Gates export. */
  isLegal: boolean;
  /** The draft has edits the cloud copy does not. Drives whether Save is live. */
  isDirty: boolean;
  /** Drives Save's transient label and disabled state; there is no dialog to report into. */
  saveState: SaveState;
}

/**
 * Deck toolbar (#473): Clear / Import / Save / Play on Duels above the deck list. Clear is a
 * two-step confirm when the deck has cards — the deck is a working draft with no
 * undo, so a stray click must not wipe it. Save is explicit and always available:
 * the draft already auto-persists locally on every edit, so this button is only ever
 * about the cloud copy, which a publishable deck must never update behind the user.
 */
export function DeckActionsBar({
  onClear,
  onImport,
  onSave,
  onExport,
  cardCount,
  isLegal,
  isDirty,
  saveState,
}: DeckActionsBarProps) {
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
          <CtaButton onClick={clearNow} aria-label={`Clear all ${cardCount} cards`}>
            Clear {cardCount} cards?
          </CtaButton>
          <CtaButton variant="neutral" onClick={() => setConfirmingClear(false)}>
            Keep
          </CtaButton>
        </>
      ) : (
        // Icon-only, so the label moves into aria-label: an icon button with no
        // accessible name is invisible to a screen reader. The two-step confirm
        // below still spells the action out in words, which is where it matters.
        <CtaButton
          variant="neutral"
          onClick={() => (isEmpty ? undefined : setConfirmingClear(true))}
          disabled={isEmpty}
          title="Clear deck"
          aria-label="Clear deck">
          <ClearIcon />
        </CtaButton>
      )}

      {/*
        Ghost, matching Import: Duels below is the bar's ONE filled button, and a
        second one would cost that distinction the meaning it was given.

        The label rests at "Save" (owner ruling 2026-08-02). Unsaved work is
        signalled by whether the button is LIVE, not by rewording it: dim means
        the cloud copy already matches, live means it does not. Disabled rather
        than hidden so the bar never changes shape mid-build, and because Clear
        beside it already teaches that a dim button means "nothing to do here".

        This is also what keeps `isDirty` load-bearing. Drop it and the flag has
        no consumer at all, which would leave the app maintaining correctness it
        never reads.

        The transient states stay, because they are not decoration: "Saving…" is
        why the button went inert, and with the save dialog gone this button is
        the ONLY place a failure can appear, so it says so in words and carries
        the reason in the tooltip rather than swallowing it.
      */}
      <CtaButton
        variant="ghost"
        onClick={onSave}
        disabled={saveState === 'saving' || (saveState === 'idle' && !isDirty)}
        title={saveDisabledReason(saveState, isDirty)}
        aria-label={saveDisabledReason(saveState, isDirty)}>
        <SaveIcon />
        {saveLabel(saveState)}
      </CtaButton>

      {/*
        Ghost, not neutral: only the destructive Clear stays neutral, so the
        quietest button in the bar is the one with no undo.
      */}
      <CtaButton variant="ghost" onClick={onImport}>
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
        aria-label={isLegal ? undefined : ILLEGAL_REASON}>
        <ExternalLinkIcon />
        Play on Duels
      </CtaButton>
    </div>
  );
}
