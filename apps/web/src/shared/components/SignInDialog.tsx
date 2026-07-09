import {useEffect, useState} from 'react';
import {useSession, type AuthProvider} from '../contexts/SessionContext';
import {COLORS, FONTS, RADIUS, SPACING, Z_INDEX} from '../constants';

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
 * render here; on failure it surfaces the error inline. Solid scrim (no backdrop-filter,
 * which is a WebKit E2E repaint trap).
 */
export function SignInDialog({isOpen, onClose}: SignInDialogProps) {
  const {signIn, enabled} = useSession();
  const [busy, setBusy] = useState<AuthProvider | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const start = async (provider: AuthProvider) => {
    setBusy(provider);
    setError(null);
    const {error: err} = await signIn(provider);
    if (err) {
      setError(err);
      setBusy(null);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: Z_INDEX.modal,
        background: 'rgba(4, 4, 10, 0.72)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: SPACING.lg,
        fontFamily: FONTS.body,
      }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Sign in to Inkweave"
        style={{
          width: '100%',
          maxWidth: 360,
          background: COLORS.surface,
          border: `1px solid ${COLORS.surfaceBorder}`,
          borderRadius: RADIUS.card,
          padding: SPACING.xl,
          boxShadow: '0 24px 60px -20px rgba(0,0,0,0.7)',
        }}>
        <h2 style={{fontFamily: FONTS.hero, fontSize: 20, color: COLORS.text, margin: 0}}>
          Sign in to Inkweave
        </h2>
        <p style={{fontSize: 13, color: COLORS.textMuted, marginTop: SPACING.sm}}>
          Save your decks and open them from any device.
        </p>

        <div style={{display: 'flex', flexDirection: 'column', gap: SPACING.sm, marginTop: SPACING.lg}}>
          {PROVIDERS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => start(p.id)}
              disabled={!enabled || busy !== null}
              style={{
                padding: `${SPACING.md}px ${SPACING.lg}px`,
                background: COLORS.primary,
                color: COLORS.background,
                border: 'none',
                borderRadius: RADIUS.md,
                fontSize: 14,
                fontWeight: 600,
                cursor: enabled && busy === null ? 'pointer' : 'default',
                opacity: !enabled || busy !== null ? 0.6 : 1,
              }}>
              {busy === p.id ? 'Redirecting…' : p.label}
            </button>
          ))}
        </div>

        {!enabled && (
          <p style={{fontSize: 12, color: COLORS.textMuted, marginTop: SPACING.md}}>
            Auth is not configured in this environment.
          </p>
        )}
        {error && (
          <p role="alert" style={{fontSize: 12, color: COLORS.error, marginTop: SPACING.md}}>
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={onClose}
          style={{
            marginTop: SPACING.lg,
            width: '100%',
            padding: `${SPACING.sm}px`,
            background: 'transparent',
            color: COLORS.textMuted,
            border: `1px solid ${COLORS.surfaceBorder}`,
            borderRadius: RADIUS.md,
            fontSize: 13,
            cursor: 'pointer',
          }}>
          Cancel
        </button>
      </div>
    </div>
  );
}
