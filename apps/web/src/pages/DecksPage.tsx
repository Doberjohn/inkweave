import {useState} from 'react';
import {Link} from 'react-router-dom';
import {useSession} from '../shared/contexts/SessionContext';
import {SignInDialog} from '../shared/components/SignInDialog';
import {CompactHeader} from '../shared/components';
import {useResponsive} from '../shared/hooks';
import {COLORS, FONTS, LAYOUT, RADIUS, SPACING} from '../shared/constants';

/**
 * `/decks` — the user's deck list. Local drafts and cloud decks fill in with #473/#464;
 * this scaffold (#466) also carries the auth entry point (#463): sign in to save decks.
 */
export function DecksPage() {
  const {user, enabled, loading, signOut} = useSession();
  const {isMobile} = useResponsive();
  const [signInOpen, setSignInOpen] = useState(false);

  return (
    <>
      <CompactHeader isMobile={isMobile} />
      <main
        style={{
          minHeight: `calc(100vh - ${LAYOUT.compactHeaderHeight}px)`,
          background: COLORS.background,
          padding: SPACING.xl,
          maxWidth: 900,
          margin: '0 auto',
        }}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: SPACING.md}}>
          <h1 style={{fontFamily: FONTS.hero, fontSize: 20, color: COLORS.text, margin: 0}}>Your Decks</h1>
          {enabled && !loading && user && (
            <div style={{display: 'flex', alignItems: 'center', gap: SPACING.sm}}>
              <span style={{fontFamily: FONTS.body, fontSize: 12, color: COLORS.textMuted}}>
                {user.email ?? 'Signed in'}
              </span>
              <button
                type="button"
                onClick={() => void signOut()}
                style={{
                  padding: `4px ${SPACING.md}px`,
                  background: 'transparent',
                  color: COLORS.textMuted,
                  border: `1px solid ${COLORS.surfaceBorder}`,
                  borderRadius: RADIUS.md,
                  fontSize: 12,
                  cursor: 'pointer',
                }}>
                Sign out
              </button>
            </div>
          )}
          {enabled && !loading && !user && (
            <button
              type="button"
              onClick={() => setSignInOpen(true)}
              style={{
                padding: `6px ${SPACING.lg}px`,
                background: 'transparent',
                color: COLORS.primary,
                border: `1px solid ${COLORS.primary}`,
                borderRadius: RADIUS.md,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}>
              Sign in
            </button>
          )}
        </div>

        <p style={{fontFamily: FONTS.body, fontSize: 13, color: COLORS.textMuted, marginTop: SPACING.sm}}>
          Build a Core-legal deck with live synergy guidance.
        </p>
        <Link
          to="/decks/new"
          style={{
            display: 'inline-block',
            marginTop: SPACING.lg,
            padding: `${SPACING.sm}px ${SPACING.lg}px`,
            background: COLORS.primary,
            color: COLORS.background,
            fontFamily: FONTS.body,
            fontSize: 14,
            fontWeight: 600,
            borderRadius: 10,
            textDecoration: 'none',
          }}>
          + New deck
        </Link>

        <SignInDialog isOpen={signInOpen} onClose={() => setSignInOpen(false)} />
      </main>
    </>
  );
}
