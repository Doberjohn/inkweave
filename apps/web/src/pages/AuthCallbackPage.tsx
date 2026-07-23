import {useEffect, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {useSession} from '../shared/contexts/SessionContext';
import {CtaButton} from '../shared/components';
import {COLORS, FONTS, FONT_SIZES, SPACING} from '../shared/constants';

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
          <p style={{color: COLORS.text, fontSize: FONT_SIZES.xl, margin: 0}}>Sign-in didn't complete.</p>
          <p style={{color: COLORS.textMuted, fontSize: FONT_SIZES.base, marginTop: SPACING.sm}}>
            Please try again from the deck builder.
          </p>
          <CtaButton
            onClick={() => navigate('/decks', {replace: true})}
            style={{margin: `${SPACING.lg}px auto 0`}}>
            Back to decks
          </CtaButton>
        </div>
      ) : (
        <p style={{color: COLORS.textMuted, fontSize: FONT_SIZES.lg}}>Finishing sign-in…</p>
      )}
    </main>
  );
}
