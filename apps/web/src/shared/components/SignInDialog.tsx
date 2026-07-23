import {useState} from 'react';
import {useSession, type AuthProvider} from '../contexts/SessionContext';
import {COLORS, FONTS, FONT_SIZES, SPACING} from '../constants';
import {CtaButton} from './CtaButton';
import {DialogShell} from './DialogShell';
import {signInProviderButtonState} from './signInProviderState';

interface SignInDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const PROVIDERS: ReadonlyArray<{id: AuthProvider; label: string}> = [
  {id: 'google', label: 'Continue with Google'},
  {id: 'discord', label: 'Continue with Discord'},
];

/**
 * Sign-in modal (#463): kicks off a Google or Discord OAuth redirect via SessionContext.
 * On success the browser navigates away to the provider, so there is no success state to
 * render here; on failure it surfaces the error inline. Rides the DialogShell overlay
 * contract (#510) — trap, scroll lock, token scrim, Escape + backdrop close.
 */
export function SignInDialog({isOpen, onClose}: SignInDialogProps) {
  const {signIn, enabled} = useSession();
  const [busy, setBusy] = useState<AuthProvider | null>(null);
  const [error, setError] = useState<string | null>(null);

  const start = async (provider: AuthProvider) => {
    setBusy(provider);
    setError(null);
    try {
      const {error: err} = await signIn(provider);
      if (err) {
        setError(err);
        setBusy(null);
      }
    } catch {
      setError('Sign-in failed. Please try again.');
      setBusy(null);
    }
  };

  return (
    <DialogShell
      isOpen={isOpen}
      onClose={onClose}
      ariaLabel="Sign in to Inkweave"
      size="sm"
      panelStyle={{padding: SPACING.xl, fontFamily: FONTS.body}}>
      <h2 style={{fontFamily: FONTS.hero, fontSize: FONT_SIZES.xxl, color: COLORS.text, margin: 0}}>
        Sign in to Inkweave
      </h2>
      <p style={{fontSize: FONT_SIZES.base, color: COLORS.textMuted, marginTop: SPACING.sm}}>
        Save your decks and open them from any device.
      </p>

      <div style={{display: 'flex', flexDirection: 'column', gap: SPACING.sm, marginTop: SPACING.lg}}>
        {PROVIDERS.map((p) => {
          const button = signInProviderButtonState(p, enabled, busy);
          return (
            <CtaButton key={p.id} onClick={() => start(p.id)} disabled={button.disabled}>
              {button.label}
            </CtaButton>
          );
        })}
      </div>

      {!enabled && (
        <p style={{fontSize: FONT_SIZES.md, color: COLORS.textMuted, marginTop: SPACING.md}}>
          Auth is not configured in this environment.
        </p>
      )}
      {error && (
        <p role="alert" style={{fontSize: FONT_SIZES.md, color: COLORS.error, marginTop: SPACING.md}}>
          {error}
        </p>
      )}

      <CtaButton variant="neutral" onClick={onClose} style={{marginTop: SPACING.lg, width: '100%'}}>
        Cancel
      </CtaButton>
    </DialogShell>
  );
}
