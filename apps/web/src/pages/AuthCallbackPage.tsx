import {useEffect, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {useSession} from '../shared/contexts/SessionContext';
import {COLORS, FONTS, SPACING} from '../shared/constants';

/**
 * `/auth/callback` (#463) — the OAuth provider redirects here after consent. supabase-js
 * (detectSessionInUrl + PKCE) exchanges the code automatically; SessionContext then
 * observes the new session and we route into the deck builder. A short grace period guards
 * against a failed/invalid exchange so the user isn't stuck on a spinner.
 */
export function AuthCallbackPage() {
  const {session, loading} = useSession();
  const navigate = useNavigate();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (session) {
      navigate('/decks', {replace: true});
      return;
    }
    const timer = setTimeout(() => setFailed(true), 4000);
    return () => clearTimeout(timer);
  }, [loading, session, navigate]);

  return (
    <main
      style={{
        minHeight: '100vh',
        background: COLORS.background,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: SPACING.xl,
        fontFamily: FONTS.body,
      }}>
      {failed ? (
        <div style={{textAlign: 'center', maxWidth: 360}}>
          <p style={{color: COLORS.text, fontSize: 16, margin: 0}}>Sign-in didn't complete.</p>
          <p style={{color: COLORS.textMuted, fontSize: 13, marginTop: SPACING.sm}}>
            Please try again from the deck builder.
          </p>
          <button
            type="button"
            onClick={() => navigate('/decks', {replace: true})}
            style={{
              marginTop: SPACING.lg,
              padding: `${SPACING.sm}px ${SPACING.lg}px`,
              background: COLORS.primary,
              color: COLORS.background,
              border: 'none',
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}>
            Back to decks
          </button>
        </div>
      ) : (
        <p style={{color: COLORS.textMuted, fontSize: 14}}>Finishing sign-in…</p>
      )}
    </main>
  );
}
