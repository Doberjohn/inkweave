import {useState} from 'react';
import {CtaButton, DialogShell, LinkButton} from '../../../shared/components';
import {
  COLORS,
  DISABLED_STYLE,
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
  /** Guests get one local deck, so starting another destroys the current one. */
  showReplaceWarning: boolean;
  /** Publishing needs an account. */
  canPublish: boolean;
  onSignIn: () => void;
}

/**
 * Shared `name` so the two inputs form ONE native radio group: that is what gives
 * arrow-key navigation and single-selection for free, rather than hand-rolling them.
 */
const VISIBILITY_GROUP = 'new-deck-visibility';

/** One string, read out with the disabled Public option and shown beneath the group. */
const PUBLISH_NEEDS_ACCOUNT = 'Sign in to publish.';

/**
 * The warning is also the offer. A guest is about to lose work precisely because
 * there is no account behind it, so the remedy belongs at the moment of loss, not
 * in a banner they already scrolled past.
 */
function ReplaceWarning({onSignIn}: {onSignIn: () => void}) {
  return (
    <div
      style={{
        marginTop: SPACING.md,
        padding: SPACING.md,
        background: COLORS.surfaceAlt,
        border: `1px solid ${COLORS.surfaceBorder}`,
        borderRadius: RADIUS.lg,
      }}>
      <p style={{margin: 0, color: COLORS.textMuted, fontFamily: FONTS.body, fontSize: `${FONT_SIZES.base}px`}}>
        Starting a new deck replaces your current one, which isn't saved to an account yet.
      </p>
      <LinkButton onClick={onSignIn} underlineOnHover style={{marginTop: SPACING.xs}}>
        Sign in to keep both
      </LinkButton>
    </div>
  );
}

interface VisibilityOptionProps {
  value: DeckVisibility;
  title: string;
  description: string;
  /**
   * Why the option cannot be picked. Announced with the option, but rendered by the
   * PARENT outside the row: DISABLED_STYLE dims the whole label to 0.4, which would
   * bury the one line the user actually needs to read.
   */
  disabledReason?: string;
  selected: boolean;
  disabled?: boolean;
  onSelect: (value: DeckVisibility) => void;
}

/**
 * A native radio inside its label: the input carries the semantics and keyboard
 * behavior, the surrounding row carries the selection styling. `aria-label` repeats
 * the whole row so the description is announced with the choice rather than skipped.
 */
function VisibilityOption({value, title, description, disabledReason, selected, disabled, onSelect}: VisibilityOptionProps) {
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
        ...(disabled ? DISABLED_STYLE : {}),
      }}>
      <input
        type="radio"
        name={VISIBILITY_GROUP}
        value={value}
        checked={selected}
        disabled={disabled}
        aria-label={disabledReason ? `${title}. ${description} ${disabledReason}` : `${title}. ${description}`}
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
 * Public stays VISIBLE but disabled for a guest rather than being hidden: a hidden
 * option cannot explain why publishing is unavailable, and silently downgrading a
 * chosen "public" to private at save time would be worse than refusing it up front.
 */
export function NewDeckDialog({
  isOpen,
  onClose,
  onConfirm,
  showReplaceWarning,
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
      <h2 style={{fontFamily: FONTS.hero, fontSize: FONT_SIZES.xxl, color: COLORS.text, margin: 0}}>New deck</h2>

      {showReplaceWarning && <ReplaceWarning onSignIn={onSignIn} />}

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
          disabledReason={canPublish ? undefined : PUBLISH_NEEDS_ACCOUNT}
          selected={visibility === 'public'}
          disabled={!canPublish}
          onSelect={setVisibility}
        />
      </div>

      {/* Outside the radiogroup on purpose: a non-radio child would break the role's
          owned-elements contract, and out here it escapes the row's disabled dimming. */}
      {!canPublish && (
        <p
          style={{
            margin: `${SPACING.sm}px 0 0`,
            color: COLORS.primary,
            fontFamily: FONTS.body,
            fontSize: `${FONT_SIZES.base}px`,
          }}>
          {PUBLISH_NEEDS_ACCOUNT}
        </p>
      )}

      <div style={{display: 'flex', gap: SPACING.sm, marginTop: SPACING.lg}}>
        <CtaButton variant="filled" onClick={startBuilding} style={{flex: 1}}>
          Start building
        </CtaButton>
        <CtaButton variant="neutral" onClick={close} style={{flex: 1}}>
          Cancel
        </CtaButton>
      </div>
    </DialogShell>
  );
}
