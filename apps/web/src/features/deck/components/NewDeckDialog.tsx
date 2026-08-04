import {useState} from 'react';
import {CtaButton, DialogShell, LinkButton} from '../../../shared/components';
import {
  COLORS,
  DIALOG_BODY,
  DIALOG_TITLE,
  FONTS,
  FONT_SIZES,
  GOLD_GLOW,
  RADIUS,
  SPACING,
} from '../../../shared/constants';

type DeckVisibility = 'private' | 'public';

interface NewDeckDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (visibility: DeckVisibility) => void;
  /** The working draft has unsaved work that starting fresh would discard. */
  showReplaceWarning: boolean;
  /** Guests only: an account is what would have made the loss avoidable. */
  canKeepBoth: boolean;
  /** Publishing needs an account, so a guest is not asked about visibility. */
  canPublish: boolean;
  onSignIn: () => void;
}

/**
 * Shared `name` so the two inputs form ONE native radio group: that is what gives
 * arrow-key navigation and single-selection for free, rather than hand-rolling them.
 */
const VISIBILITY_GROUP = 'new-deck-visibility';

/**
 * For a guest the warning is also the OFFER: they are about to lose work precisely
 * because there is no account behind it, so the remedy belongs at the moment of
 * loss rather than in a banner they already scrolled past. A signed-in user gets
 * the warning without the offer, because they already have the account and simply
 * needed to press Save.
 */
function ReplaceWarning({canKeepBoth, onSignIn}: {canKeepBoth: boolean; onSignIn: () => void}) {
  return (
    <div
      style={{
        marginTop: SPACING.md,
        padding: SPACING.md,
        background: COLORS.surfaceAlt,
        border: `1px solid ${COLORS.surfaceBorder}`,
        borderRadius: RADIUS.lg,
      }}>
      <p style={DIALOG_BODY}>
        You already have started building a deck. Starting a new one replaces your previous.
      </p>
      {canKeepBoth && (
        <LinkButton onClick={onSignIn} underlineOnHover style={{marginTop: SPACING.xs}}>
          Sign in to keep both
        </LinkButton>
      )}
    </div>
  );
}

interface VisibilityOptionProps {
  value: DeckVisibility;
  title: string;
  description: string;
  selected: boolean;
  onSelect: (value: DeckVisibility) => void;
}

/**
 * A native radio inside its label: the input carries the semantics and keyboard
 * behavior, the surrounding row carries the selection styling. `aria-label` repeats
 * the whole row so the description is announced with the choice rather than skipped.
 */
function VisibilityOption({value, title, description, selected, onSelect}: VisibilityOptionProps) {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: SPACING.sm,
        padding: SPACING.md,
        background: selected ? GOLD_GLOW.activeBg : COLORS.surfaceAlt,
        border: `1px solid ${selected ? GOLD_GLOW.activeBorder : COLORS.surfaceBorder}`,
        borderRadius: RADIUS.lg,
        cursor: 'pointer',
      }}>
      <input
        type="radio"
        name={VISIBILITY_GROUP}
        value={value}
        checked={selected}
        aria-label={`${title}. ${description}`}
        onChange={() => onSelect(value)}
        style={{marginTop: SPACING.xxs, accentColor: COLORS.primary}}
      />
      <span>
        <span
          style={{
            display: 'block',
            color: COLORS.text,
            fontFamily: FONTS.body,
            fontSize: `${FONT_SIZES.lg}px`,
            fontWeight: 600,
          }}>
          {title}
        </span>
        <span
          style={{
            display: 'block',
            marginTop: SPACING.xxs,
            color: COLORS.textMuted,
            fontFamily: FONTS.body,
            fontSize: `${FONT_SIZES.base}px`,
          }}>
          {description}
        </span>
      </span>
    </label>
  );
}

/**
 * The gate in front of "+ New deck" (#473). Two owner rulings meet here:
 *
 * 1. Visibility is chosen at CREATION, defaulting to private. Saving is explicit and
 *    may never happen, so the choice rides the draft as a pending intent that the
 *    first save applies.
 * 2. A guest gets exactly one local deck, so starting another destroys the current
 *    one. That is worth a warning, and the warning is the natural place to offer the
 *    account that would make the loss unnecessary.
 *
 * The visibility choice is hidden entirely from a guest (owner ruling 2026-08-02):
 * they cannot save, so it could never take effect, and a disabled control that needs
 * a line of explanation beneath it is worse than not asking.
 *
 * Which means this dialog opens only when it has something to SAY. `DecksPage` skips
 * it when neither half applies, so a guest with an empty deck goes straight to the
 * builder rather than through an empty box.
 */
export function NewDeckDialog({
  isOpen,
  onClose,
  onConfirm,
  showReplaceWarning,
  canKeepBoth,
  canPublish,
  onSignIn,
}: NewDeckDialogProps) {
  const [visibility, setVisibility] = useState<DeckVisibility>('private');

  // Private is the default for EVERY new deck, not just the first one this session:
  // a user who once picked public would otherwise publish their next deck silently,
  // having been shown that choice only once. The reset happens on the way OUT rather
  // than in an open-effect (setState inside an effect is a React Compiler error), and
  // every exit funnels through these two functions: startBuilding, and close, which
  // DialogShell also calls for Escape and backdrop clicks.
  const close = () => {
    setVisibility('private');
    onClose();
  };

  const startBuilding = () => {
    onConfirm(visibility);
    setVisibility('private');
  };

  return (
    <DialogShell
      isOpen={isOpen}
      onClose={close}
      ariaLabel="New deck"
      size="md"
      scrimTestId="new-deck-backdrop"
      panelStyle={{padding: SPACING.xl, fontFamily: FONTS.body}}>
      <h2 style={DIALOG_TITLE}>New deck</h2>

      {showReplaceWarning && <ReplaceWarning canKeepBoth={canKeepBoth} onSignIn={onSignIn} />}

      {/* Shown only to someone who can act on it. A guest cannot save, so cannot
          publish, so the choice could never take effect: offering it disabled meant
          a dead control plus a line apologising for it. */}
      {canPublish && (
        <div
          role="radiogroup"
          aria-label="Deck visibility"
          style={{display: 'flex', flexDirection: 'column', gap: SPACING.sm, marginTop: SPACING.lg}}>
          <VisibilityOption
            value="private"
            title="Private"
            description="Only you can see it."
            selected={visibility === 'private'}
            onSelect={setVisibility}
          />
          <VisibilityOption
            value="public"
            title="Public"
            description="Anyone can see it and it appears in community decks."
            selected={visibility === 'public'}
            onSelect={setVisibility}
          />
        </div>
      )}

      <div style={{display: 'flex', gap: SPACING.sm, marginTop: SPACING.lg}}>
        {/* Cancel first, confirm last: the destructive-adjacent action sits where the
            eye finishes, not where it lands. */}
        <CtaButton variant="neutral" onClick={close} style={{flex: 1}}>
          Cancel
        </CtaButton>
        <CtaButton variant="filled" onClick={startBuilding} style={{flex: 1}}>
          Build a new deck
        </CtaButton>
      </div>
    </DialogShell>
  );
}
