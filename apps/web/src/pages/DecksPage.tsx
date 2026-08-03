import {useState} from 'react';
import {Link} from 'react-router-dom';
import {CompactHeader, CtaButton} from '../shared/components';
import {SignInDialog} from '../shared/components/SignInDialog';
import {CTA_BASE_STYLE, CTA_FILLED_STYLE} from '../shared/components/ctaStyles';
import {useResponsive} from '../shared/hooks';
import {useSession} from '../shared/contexts/SessionContext';
import {COLORS, FONTS, FONT_SIZES, LAYOUT, SPACING, SURFACE_CARD} from '../shared/constants';

/**
 * `/decks` — the community deck hub, with your own decks as a tab within it
 * (owner ruling 2026-08-01, PLAN.md Phase 1). NOT an account-scoped page: that
 * reading is what put Decks in the desktop nav beside Browse/Playstyles/Vote,
 * and it is why there is no `/decks/feed` (#454's route moved here).
 *
 * The community feed does not exist until Phase 4 (#454), so there is no tab
 * strip yet: a `TabList` carrying one tab is chrome that explains nothing. The
 * second tab arrives with the content behind it, and the feed becomes default.
 *
 * Deck lists themselves fill in with #473/#464.
 */
export function DecksPage() {
  const {isMobile} = useResponsive();

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
        <h1 style={{fontFamily: FONTS.hero, fontSize: FONT_SIZES.xxl, color: COLORS.text, margin: 0}}>Decks</h1>

        <p style={{fontFamily: FONTS.body, fontSize: FONT_SIZES.base, color: COLORS.textMuted, marginTop: SPACING.sm}}>
          Build a Core-legal deck with live synergy guidance.
        </p>
        {/*
          The kit's filled CTA worn by a Link, not a CtaButton. It stays an anchor
          deliberately: this navigates, so middle-click, open-in-new-tab and
          crawlability all matter — the same reason CompactHeader's Reveals pill is
          a NavLink. Spreading BASE + FILLED means it IS the landing page CTA rather
          than a copy of it (owner ruling 2026-07-31); it previously hand-rolled a
          flat COLORS.primary with no gradient, shadow, hover or press.
        */}
        <Link
          to="/decks/new"
          style={{
            ...CTA_BASE_STYLE,
            ...CTA_FILLED_STYLE,
            display: 'inline-flex',
            marginTop: SPACING.lg,
          }}>
          + New deck
        </Link>

        <DeckAccountPanel isMobile={isMobile} />
      </main>
    </>
  );
}

/**
 * The contextual half of the sign-in ruling (2026-08-01): the header carries a
 * quiet control on every desktop page, and `/decks` additionally says what
 * signing in BUYS you. Signing in is an upgrade, not a gate — the builder works
 * fully signed out on localStorage drafts, and `useFirstSignInMigration` lifts
 * the anonymous draft into the account on first sign-in.
 *
 * Two asymmetries, both deliberate:
 *
 * - The signed-OUT prompt shows on every viewport, because its job is to explain
 *   value, not just to be reachable.
 * - The signed-IN block is MOBILE ONLY. `CompactHeader` returns null on mobile,
 *   so without this a phone user who signs in here could never sign out again
 *   (the regression `7dfb4dd3` shipped). On desktop the header already carries
 *   Sign out, and a second one here would be redundant chrome.
 *
 * Renders nothing while `loading` or when auth is unconfigured, matching
 * `HeaderAuth`: `user` is null during load, so the naive version flashes the
 * signed-out prompt at every returning user on every visit.
 */
const PANEL_STYLE: React.CSSProperties = {...SURFACE_CARD, marginTop: SPACING.xxl, padding: SPACING.lg};

const PANEL_TEXT_STYLE: React.CSSProperties = {
  fontFamily: FONTS.body,
  fontSize: FONT_SIZES.base,
  color: COLORS.textMuted,
  marginTop: 0,
  marginBottom: SPACING.md,
};

function DeckAccountPanel({isMobile}: {isMobile: boolean}) {
  const {user, enabled, loading, signOut} = useSession();
  const [signInOpen, setSignInOpen] = useState(false);

  if (!enabled || loading) return null;

  if (user) {
    if (!isMobile) return null;
    return (
      <div style={PANEL_STYLE}>
        <p style={PANEL_TEXT_STYLE}>
          Signed in as {user.email ?? 'your account'}. Your decks sync across devices.
        </p>
        <CtaButton variant="neutral" onClick={() => void signOut()}>
          Sign out
        </CtaButton>
      </div>
    );
  }

  return (
    <div style={PANEL_STYLE}>
      <p style={PANEL_TEXT_STYLE}>
        Your decks are saved on this device. Sign in to keep them on your phone and computer both.
      </p>
      <CtaButton variant="ghost" onClick={() => setSignInOpen(true)}>
        Sign in
      </CtaButton>
      <SignInDialog isOpen={signInOpen} onClose={() => setSignInOpen(false)} />
    </div>
  );
}
