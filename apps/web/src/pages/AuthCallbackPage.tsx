import {useEffect, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {useSession} from '../shared/contexts/SessionContext';
import {
  callbackFailureReason,
  trackSignInCompleted,
  trackSignInFailed,
} from '../shared/lib/signInAnalytics';
import {CtaButton} from '../shared/components';
import {COLORS, FONTS, FONT_SIZES, SPACING} from '../shared/constants';

/**
 * `/auth/callback` (#463) — the OAuth provider redirects here after consent. The Supabase
 * SDK (detectSessionInUrl + PKCE) exchanges the code automatically; SessionContext then
 * observes the new session and we route onward. A short grace period guards against a
 * failed/invalid exchange so the user isn't stuck on a spinner.
 */

/**
 * Where a completed sign-in lands.
 *
 * The deck builder is the eventual destination, since signing in exists to save decks.
 * But `/decks` belongs to a later PR in this split and the router defines no such route
 * yet, so navigating there would hand every successful sign-in to the catch-all 404.
 * `/account` is the only account surface this PR ships. Repoint this one constant when
 * the deck routes land.
 */
const POST_SIGN_IN_ROUTE = '/account';

export function AuthCallbackPage() {
  const {session, loading} = useSession();
  const navigate = useNavigate();
  const [failed, setFailed] = useState(false);
  // The OAuth error the provider sent back, if any, rides on the URL this page opened on. Read it
  // once, on the first render, so later URL changes can't reword the failure.
  const [failureReason] = useState(() => callbackFailureReason(window.location));

  useEffect(() => {
    if (loading) return;
    if (session) {
      trackSignInCompleted(session);
      navigate(POST_SIGN_IN_ROUTE, {replace: true});
      return;
    }
    const timer = setTimeout(() => {
      trackSignInFailed({provider: null, stage: 'callback', reason: failureReason});
      setFailed(true);
    }, 4000);
    return () => clearTimeout(timer);
  }, [loading, session, navigate, failureReason]);

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
            Please try again from your account page.
          </p>
          <CtaButton
            onClick={() => navigate(POST_SIGN_IN_ROUTE, {replace: true})}
            style={{margin: `${SPACING.lg}px auto 0`}}>
            Go to your account
          </CtaButton>
        </div>
      ) : (
        <p style={{color: COLORS.textMuted, fontSize: FONT_SIZES.lg}}>Finishing sign-in…</p>
      )}
    </main>
  );
}
