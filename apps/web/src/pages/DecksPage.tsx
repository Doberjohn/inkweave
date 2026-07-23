import {useState} from 'react';
import {Link} from 'react-router-dom';
import {useSession} from '../shared/contexts/SessionContext';
import {SignInDialog} from '../shared/components/SignInDialog';
import {CompactHeader, CtaButton} from '../shared/components';
import {useResponsive} from '../shared/hooks';
import {COLORS, FONTS, FONT_SIZES, LAYOUT, RADIUS, SPACING} from '../shared/constants';

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
          <h1 style={{fontFamily: FONTS.hero, fontSize: FONT_SIZES.xxl, color: COLORS.text, margin: 0}}>Your Decks</h1>
          {enabled && !loading && user && (
            <div style={{display: 'flex', alignItems: 'center', gap: SPACING.sm}}>
              <span style={{fontFamily: FONTS.body, fontSize: FONT_SIZES.md, color: COLORS.textMuted}}>
                {user.email ?? 'Signed in'}
              </span>
              <CtaButton
                variant="neutral"
                onClick={() => void signOut()}
                style={{minHeight: 0, padding: `4px ${SPACING.md}px`, fontSize: FONT_SIZES.md}}>
                Sign out
              </CtaButton>
            </div>
          )}
          {enabled && !loading && !user && (
            <CtaButton
              variant="ghost"
              onClick={() => setSignInOpen(true)}
              style={{minHeight: 0, padding: `6px ${SPACING.lg}px`, fontSize: FONT_SIZES.base}}>
              Sign in
            </CtaButton>
          )}
        </div>

        <p style={{fontFamily: FONTS.body, fontSize: FONT_SIZES.base, color: COLORS.textMuted, marginTop: SPACING.sm}}>
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
            fontSize: FONT_SIZES.lg,
            fontWeight: 600,
            borderRadius: RADIUS.lg,
            textDecoration: 'none',
          }}>
          + New deck
        </Link>

        <SignInDialog isOpen={signInOpen} onClose={() => setSignInOpen(false)} />
      </main>
    </>
  );
}
