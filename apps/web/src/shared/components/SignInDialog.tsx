import {useState} from 'react';
import {useSession, type AuthProvider} from '../contexts/SessionContext';
import {trackSignInFailed, trackSignInStarted, type SignInSurface} from '../lib/signInAnalytics';
import {
  COLORS,
  DIALOG_BODY,
  DIALOG_TITLE,
  FONTS,
  FONT_SIZES,
  ICON_SIZE,
  PROVIDER_COLORS,
  SPACING,
} from '../constants';
import discordLogo from '../../assets/discord.svg?no-inline';
import googleLogo from '../../assets/google.svg?no-inline';
import {CtaButton} from './CtaButton';
import {DialogShell} from './DialogShell';
import {IconButton} from './IconButton';
import {signInProviderButtonState} from './signInProviderState';

interface SignInDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** Where the dialog was opened, for `sign_in_started`. Required, so no caller goes untracked. */
  surface: SignInSurface;
}

const PROVIDERS: ReadonlyArray<{id: AuthProvider; label: string}> = [
  {id: 'google', label: 'Continue with Google'},
  {id: 'discord', label: 'Continue with Discord'},
];

/**
 * The wordmark the header shows, so a visitor coming from it already has the file. Its
 * intrinsic size reserves the box before the file arrives (a phone has no header to have
 * fetched it).
 */
const WORDMARK = {src: '/brand/logo.svg', width: 857, height: 193} as const;

/**
 * Each provider in its own colours, with its logo (owner, 2026-10-22): Google's white button
 * and Discord's Blurple. The logos are their own files, `?no-inline` so their bytes stay out
 * of the header's chunk, which every page loads; the dialog fetches them when it opens.
 */
const PROVIDER_LOOK: Record<AuthProvider, {logo: string; style: React.CSSProperties}> = {
  google: {
    logo: googleLogo,
    style: {
      background: PROVIDER_COLORS.google.bg,
      color: PROVIDER_COLORS.google.text,
      border: `1px solid ${PROVIDER_COLORS.google.border}`,
    },
  },
  discord: {
    logo: discordLogo,
    style: {background: PROVIDER_COLORS.discord.bg, color: PROVIDER_COLORS.discord.text},
  },
};

/** Laid over CtaButton's filled recipe, so the boop, press and disabled states stay the kit's. */
const PROVIDER_BUTTON_STYLE: React.CSSProperties = {
  boxShadow: 'none',
  gap: SPACING.md,
  fontSize: FONT_SIZES.lg,
};

/**
 * Sign-in modal (#463): kicks off a Google or Discord OAuth redirect via SessionContext.
 * On success the browser navigates away to the provider, so there is no success state to
 * render here; on failure it surfaces the error inline. Rides the DialogShell overlay
 * contract (#510) — trap, scroll lock, token scrim, Escape + backdrop close. The close ×
 * is its one visible way out, since it has no Cancel button.
 */
export function SignInDialog({isOpen, onClose, surface}: SignInDialogProps) {
  const {signIn, enabled} = useSession();
  const [busy, setBusy] = useState<AuthProvider | null>(null);
  const [error, setError] = useState<string | null>(null);

  const start = async (provider: AuthProvider) => {
    trackSignInStarted({provider, surface});
    setBusy(provider);
    setError(null);
    try {
      const {error: err} = await signIn(provider);
      if (err) {
        trackSignInFailed({provider, stage: 'start', reason: 'error'});
        setError(err);
        setBusy(null);
      }
    } catch {
      trackSignInFailed({provider, stage: 'start', reason: 'error'});
      setError('Sign-in failed. Please try again.');
      setBusy(null);
    }
  };

  /**
   * Closing clears the attempt. `busy` is deliberately left set on a successful
   * `signIn`, because the browser is leaving for the provider and there is no success
   * state to render — but the component outlives that: only DialogShell's children
   * unmount, so this state survives every open/close cycle. Without this reset, a user
   * who comes back via the back button (bfcache) or cancels a slow redirect reopens a
   * dialog still stuck on "Redirecting…", with no way to retry short of a full reload.
   */
  const handleClose = () => {
    setBusy(null);
    setError(null);
    onClose();
  };

  return (
    <DialogShell
      isOpen={isOpen}
      onClose={handleClose}
      ariaLabel="Sign in to Inkweave"
      size="sm"
      panelStyle={{position: 'relative', padding: SPACING.xxl, fontFamily: FONTS.body, textAlign: 'center'}}>
      <IconButton
        aria-label="Close"
        onClick={handleClose}
        style={{position: 'absolute', top: SPACING.sm, right: SPACING.sm, fontSize: FONT_SIZES.xxl}}>
        ×
      </IconButton>

      <img
        src={WORDMARK.src}
        alt=""
        width={WORDMARK.width}
        height={WORDMARK.height}
        draggable={false}
        style={{display: 'block', height: 40, width: 'auto', margin: `${SPACING.sm}px auto 0`}}
      />
      <h2 style={{...DIALOG_TITLE, marginTop: SPACING.lg}}>Sign in to Inkweave</h2>
      <p style={{...DIALOG_BODY, marginTop: SPACING.sm, textWrap: 'balance'}}>
        Save your collection, open it on any device, and add friends.
      </p>

      <div style={{display: 'flex', flexDirection: 'column', gap: SPACING.md, marginTop: SPACING.xl}}>
        {PROVIDERS.map((p) => {
          const button = signInProviderButtonState(p, enabled, busy);
          const look = PROVIDER_LOOK[p.id];
          return (
            <CtaButton
              key={p.id}
              onClick={() => start(p.id)}
              disabled={button.disabled}
              style={{...PROVIDER_BUTTON_STYLE, ...look.style}}>
              <img src={look.logo} alt="" width={ICON_SIZE.md} height={ICON_SIZE.md} style={{display: 'block'}} />
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
    </DialogShell>
  );
}
