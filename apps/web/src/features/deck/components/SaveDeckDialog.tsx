import {useState} from 'react';
import {CtaButton, DialogShell} from '../../../shared/components';
import {CAP_LABEL_XS, COLORS, FONTS, FONT_SIZES, RADIUS, SPACING} from '../../../shared/constants';
import {useSession} from '../../../shared/contexts/SessionContext';
import {upsertDeck, useDeck} from '../state';

/**
 * The one thing this message must do is stop the user reaching for their notes app.
 * A failed cloud save costs them nothing, because the draft they can see is the one
 * that auto-persists locally, and it was never touched by the attempt.
 */
const SAVE_FAILED =
  'Could not reach your account. Nothing was lost: the deck is still saved on this device, exactly as you left it. Try again in a moment.';

interface SaveDeckDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** Opens the PAGE's SignInDialog; see the note on the component below. */
  onSignIn: () => void;
}

/**
 * The signed-out face. Deliberately NOT a disabled form: a guest pressing Save is
 * asking for exactly what an account provides, so the honest response is the offer,
 * not a locked field they have to look at to understand. It opens with the
 * reassurance because the fear it answers ("am I about to lose this?") is the one
 * that makes people abandon the flow.
 */
function SignInPitch({onSignIn, onClose}: {onSignIn: () => void; onClose: () => void}) {
  return (
    <>
      <h2 style={{fontFamily: FONTS.hero, fontSize: FONT_SIZES.xxl, color: COLORS.text, margin: 0}}>
        Save to account
      </h2>
      <p
        style={{
          margin: `${SPACING.sm}px 0 0`,
          color: COLORS.textMuted,
          fontFamily: FONTS.body,
          fontSize: `${FONT_SIZES.base}px`,
        }}>
        This deck is already saved on this device. An account keeps more than one of them,
        opens them on any device you sign in from, and lets you publish a deck for other
        players to see. Signing in brings this deck with you.
      </p>

      <div style={{display: 'flex', gap: SPACING.sm, marginTop: SPACING.lg}}>
        <CtaButton variant="filled" onClick={onSignIn} style={{flex: 1}}>
          Sign in
        </CtaButton>
        <CtaButton variant="neutral" onClick={onClose} style={{flex: 1}}>
          Not now
        </CtaButton>
      </div>
    </>
  );
}

/**
 * The signed-in face: the only place the cloud copy of a deck changes.
 *
 * Two invariants hold the failure path together, and both are about never charging
 * the user for a network problem:
 *
 * 1. The DRAFT IS NOT TOUCHED before the write lands. The typed name goes straight
 *    into the upsert payload rather than through `renameDeck`, so a failed save
 *    leaves the deck byte-identical and still dirty, and the Save button still
 *    reads "Save changes".
 * 2. The dialog STAYS OPEN on failure with the typed name intact, so retrying is
 *    one click and not a re-type.
 *
 * `markSaved` binds the draft to the row the server echoed back, which is also what
 * clears the dirty flag.
 */
function SaveForm({userId, onClose}: {userId: string; onClose: () => void}) {
  const {deck, markSaved} = useDeck();
  // Seeded once per OPEN rather than once per page: DialogShell unmounts its children
  // while closed, so this component remounts on each open and re-reads the live name.
  // That is why there is no reset-on-exit dance here (contrast NewDeckDialog, whose
  // state sits outside the shell and must be reset by hand).
  const [name, setName] = useState(deck.name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = name.trim();

  const save = async () => {
    setSaving(true);
    setError(null);
    const {data, error: writeError} = await upsertDeck({...deck, name: trimmed, ownerId: userId}, userId);
    // `data` can be null with no error when RLS hides the written row; treat that as a
    // failure too, since we have nothing to bind the draft to and must not claim success.
    if (writeError !== null || data === null) {
      setSaving(false);
      setError(SAVE_FAILED);
      return;
    }
    markSaved(data);
    onClose();
  };

  return (
    <>
      <h2 style={{fontFamily: FONTS.hero, fontSize: FONT_SIZES.xxl, color: COLORS.text, margin: 0}}>Save deck</h2>

      <input
        aria-label="Deck name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Untitled deck"
        style={{
          width: '100%',
          marginTop: SPACING.lg,
          padding: SPACING.sm,
          background: COLORS.surfaceAlt,
          border: `1px solid ${COLORS.surfaceBorder}`,
          borderRadius: RADIUS.md,
          color: COLORS.text,
          fontFamily: FONTS.body,
          fontSize: `${FONT_SIZES.lg}px`,
        }}
      />

      {/* Read-out, not a field: inks are DERIVED from the cards in the deck, so offering
          them for editing would invite a value the deck itself immediately contradicts. */}
      <div style={{marginTop: SPACING.md}}>
        <span style={{...CAP_LABEL_XS, display: 'block'}}>Inks</span>
        <span
          style={{
            display: 'block',
            marginTop: SPACING.xxs,
            color: COLORS.text,
            fontFamily: FONTS.body,
            fontSize: `${FONT_SIZES.base}px`,
          }}>
          {deck.inks.length > 0 ? deck.inks.join(' / ') : 'None yet'}
        </span>
      </div>

      {error !== null && (
        <p
          role="alert"
          style={{
            margin: `${SPACING.md}px 0 0`,
            color: COLORS.error,
            fontFamily: FONTS.body,
            fontSize: `${FONT_SIZES.base}px`,
          }}>
          {error}
        </p>
      )}

      <div style={{display: 'flex', gap: SPACING.sm, marginTop: SPACING.lg}}>
        <CtaButton onClick={() => void save()} disabled={saving || trimmed === ''} style={{flex: 1}}>
          {saving ? 'Saving…' : 'Save'}
        </CtaButton>
        <CtaButton variant="neutral" onClick={onClose} style={{flex: 1}}>
          Cancel
        </CtaButton>
      </div>
    </>
  );
}

/**
 * The Save gate (#473). Saving to the cloud is EXPLICIT: the working draft
 * auto-persists to localStorage on every edit so work is never lost, but the row
 * other people can see changes only when someone presses Save here. Autosaving a
 * publishable deck would put half-edited states in front of visitors.
 *
 * That makes Save the conversion point for a guest, which is why the signed-out face
 * is a pitch rather than a wall: they can build freely, and this is the moment they
 * want the deck kept across devices or published. `useFirstSignInMigration` lifts the
 * existing draft into the new account, so signing in here costs them nothing.
 *
 * The SignInDialog belongs to the PAGE, not to this dialog (the NewDeckDialog
 * precedent): two mounted copies would be two open-states for one OAuth redirect.
 */
export function SaveDeckDialog({isOpen, onClose, onSignIn}: SaveDeckDialogProps) {
  const {user} = useSession();

  return (
    <DialogShell
      isOpen={isOpen}
      onClose={onClose}
      ariaLabel={user ? 'Save deck' : 'Save to account'}
      size="md"
      scrimTestId="save-deck-backdrop"
      panelStyle={{padding: SPACING.xl, fontFamily: FONTS.body}}>
      {user ? (
        <SaveForm userId={user.id} onClose={onClose} />
      ) : (
        <SignInPitch onSignIn={onSignIn} onClose={onClose} />
      )}
    </DialogShell>
  );
}
