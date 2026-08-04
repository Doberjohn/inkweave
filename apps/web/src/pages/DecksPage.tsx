import {useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {CompactHeader, CtaButton} from '../shared/components';
import {SignInDialog} from '../shared/components/SignInDialog';
import {NewDeckDialog} from '../features/deck/components/NewDeckDialog';
import {useDeck} from '../features/deck/state';
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
  const {deck, startNewDeck} = useDeck();
  const {user} = useSession();
  const navigate = useNavigate();
  const [newDeckOpen, setNewDeckOpen] = useState(false);
  // One instance for the page, shared by the account panel and the new-deck dialog's
  // "keep both" offer. Two mounted SignInDialogs would be two independent open-states
  // for one OAuth redirect, and the second is only ever reachable by accident.
  const [signInOpen, setSignInOpen] = useState(false);

  // Visibility rides the draft as a pending intent and the first save applies it, so
  // the choice has to be made before the builder opens, not after.
  const confirmNewDeck = (visibility: 'private' | 'public') => {
    startNewDeck(visibility);
    setNewDeckOpen(false);
    navigate('/decks/new');
  };

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
          This was a <Link> spreading the kit's filled CTA, and the anchor was
          deliberate: middle-click, open-in-new-tab and crawlability all mattered.
          Creating a deck now asks two questions first (visibility, and whether a
          guest is about to overwrite their one local deck), and a dialog cannot
          intervene in a native navigation. Those anchor affordances are therefore
          given up here deliberately, not overlooked. /decks/new is still directly
          reachable by URL; it just starts from whatever draft already exists.

          inline-flex because CtaButton's own `display: flex` is block-level and
          would stretch this across the 900px column the Link never filled.
        */}
        <CtaButton
          onClick={() => setNewDeckOpen(true)}
          style={{display: 'inline-flex', marginTop: SPACING.lg}}>
          + New deck
        </CtaButton>

        <DeckAccountPanel isMobile={isMobile} onSignIn={() => setSignInOpen(true)} />
      </main>

      <NewDeckDialog
        isOpen={newDeckOpen}
        onClose={() => setNewDeckOpen(false)}
        onConfirm={confirmNewDeck}
        // A signed-in draft is recoverable from the cloud; a guest's is not, and a
        // guest gets exactly one local deck, so only they can lose work here.
        showReplaceWarning={!user && deck.cards.length > 0}
        canPublish={Boolean(user)}
        onSignIn={() => {
          setNewDeckOpen(false);
          setSignInOpen(true);
        }}
      />
      <SignInDialog isOpen={signInOpen} onClose={() => setSignInOpen(false)} />
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
 *
 * The SignInDialog itself is the PAGE's, not this panel's (#473): NewDeckDialog's
 * "keep both" offer opens the same dialog, so a second mounted copy would be a
 * second open-state for one OAuth redirect.
 */
const PANEL_STYLE: React.CSSProperties = {...SURFACE_CARD, marginTop: SPACING.xxl, padding: SPACING.lg};

const PANEL_TEXT_STYLE: React.CSSProperties = {
  fontFamily: FONTS.body,
  fontSize: FONT_SIZES.base,
  color: COLORS.textMuted,
  marginTop: 0,
  marginBottom: SPACING.md,
};

function DeckAccountPanel({isMobile, onSignIn}: {isMobile: boolean; onSignIn: () => void}) {
  const {user, enabled, loading, signOut} = useSession();

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
      <CtaButton variant="ghost" onClick={onSignIn}>
        Sign in
      </CtaButton>
    </div>
  );
}
