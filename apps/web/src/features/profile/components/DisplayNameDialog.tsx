import {useState} from 'react';
import {CtaButton, DialogShell} from '../../../shared/components';
import {COLORS, FONTS, FONT_SIZES, RADIUS, SPACING} from '../../../shared/constants';
import {DISPLAY_NAME_MAX, DISPLAY_NAME_RULE, isValidDisplayName, updateDisplayName} from '../profileRepository';

interface DisplayNameDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** The signed-in user whose row is written. RLS rejects any other id. */
  userId: string;
  /** The name in force today, prefilled so the field starts from something real. */
  current: string;
  /** Called with the saved name so the app updates without a refetch. */
  onSaved: (displayName: string) => void;
}

/**
 * Change the name your published decks appear under.
 *
 * Edits the DISPLAY NAME, not the handle. The handle is the unique identity underneath
 * and nothing renders it, so changing what people read never moves the thing the
 * uniqueness index and future /u/ URLs are built on.
 *
 * There is no availability check here and there is nothing to check: display names are
 * not unique. Two people may both be "Doberjohn"; the handles under them cannot collide.
 */
export function DisplayNameDialog({isOpen, onClose, userId, current, onSaved}: DisplayNameDialogProps) {
  /*
    `null` means untouched, and the field then FOLLOWS `current`. That is why there is
    no effect re-seeding the input when the dialog opens: an effect would have to
    setState synchronously on the isOpen flip, which cascades renders and
    `react-hooks/set-state-in-effect` rejects. Discarding the draft on close is enough.
  */
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const value = draft ?? current;
  const trimmed = value.trim();
  const canSave = isValidDisplayName(value) && trimmed !== current.trim() && !saving;

  const close = () => {
    setDraft(null);
    setError(null);
    onClose();
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    const {data, error: failure} = await updateDisplayName(userId, trimmed);
    setSaving(false);
    if (failure || !data) {
      setError(failure ?? 'Could not save that name. Try again.');
      return;
    }
    onSaved(data);
    close();
  };

  return (
    <DialogShell
      isOpen={isOpen}
      onClose={close}
      ariaLabel="Change your display name"
      size="sm"
      panelStyle={{padding: SPACING.xl, fontFamily: FONTS.body}}>
      <h2 style={{fontFamily: FONTS.hero, fontSize: FONT_SIZES.xxl, color: COLORS.text, margin: 0}}>Your name</h2>
      <p
        style={{
          color: COLORS.textMuted,
          fontFamily: FONTS.body,
          fontSize: `${FONT_SIZES.sm}px`,
          marginTop: SPACING.xs,
          lineHeight: 1.6,
        }}>
        This is the name shown on every deck you publish. {DISPLAY_NAME_RULE}
      </p>

      <input
        aria-label="Display name"
        value={value}
        onChange={(e) => setDraft(e.target.value)}
        // Matches the column's CHECK, so the field cannot compose a request the
        // database is certain to reject.
        maxLength={DISPLAY_NAME_MAX}
        autoComplete="off"
        style={{
          width: '100%',
          marginTop: SPACING.md,
          padding: SPACING.sm,
          background: COLORS.surfaceAlt,
          border: `1px solid ${error ? COLORS.errorBorder : COLORS.surfaceBorder}`,
          borderRadius: RADIUS.md,
          color: COLORS.text,
          fontFamily: FONTS.body,
          fontSize: `${FONT_SIZES.md}px`,
        }}
      />

      {/* `role="alert"` so a screen reader hears the rejection rather than only seeing it. */}
      {error && (
        <p
          role="alert"
          style={{
            color: COLORS.error,
            fontFamily: FONTS.body,
            fontSize: `${FONT_SIZES.sm}px`,
            margin: `${SPACING.sm}px 0 0`,
          }}>
          {error}
        </p>
      )}

      <div style={{display: 'flex', gap: SPACING.sm, marginTop: SPACING.lg}}>
        <CtaButton onClick={() => void save()} disabled={!canSave} style={{flex: 1}}>
          {saving ? 'Saving…' : 'Save'}
        </CtaButton>
        <CtaButton variant="neutral" onClick={close} disabled={saving} style={{flex: 1}}>
          Cancel
        </CtaButton>
      </div>
    </DialogShell>
  );
}
