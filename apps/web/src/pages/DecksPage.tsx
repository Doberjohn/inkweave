import {useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {CompactHeader, CtaButton} from '../shared/components';
import {SignInDialog} from '../shared/components/SignInDialog';
import {NewDeckDialog} from '../features/deck/components/NewDeckDialog';
import {useDeck} from '../features/deck/state';
import {useResponsive} from '../shared/hooks';
import {useSession} from '../shared/contexts/SessionContext';
import {COLORS, FONTS, FONT_SIZES, LAYOUT, SPACING} from '../shared/constants';

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
  const {deck, isDirty, startNewDeck} = useDeck();
  const {user} = useSession();
  const navigate = useNavigate();
  const [newDeckOpen, setNewDeckOpen] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);

  const openBuilder = (visibility: 'private' | 'public') => {
    startNewDeck(visibility);
    setNewDeckOpen(false);
    navigate('/decks/new');
  };

  // Starting fresh discards the working draft, and only an UNSAVED one is a loss:
  // a saved deck is still in the cloud, reachable from the list.
  const wouldDiscardWork = isDirty && deck.cards.length > 0;

  /**
   * The dialog opens only when it has something to say (owner ruling 2026-08-02).
   * It carries exactly two things, and each has its own audience:
   *
   * - the visibility choice, which only a signed-in user can act on, since a guest
   *   cannot save and so cannot publish;
   * - the replace warning, which only matters when there is unsaved work to lose.
   *
   * With neither, it was an empty box between a button and the page it leads to, so
   * a guest starting their first deck now goes straight to the builder.
   */
  const startNew = () => {
    if (user || wouldDiscardWork) return setNewDeckOpen(true);
    openBuilder('private');
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
          Creating a deck can now stop to ask a question, and a dialog cannot
          intervene in a native navigation, so those affordances are given up here
          deliberately rather than overlooked. /decks/new stays reachable by URL.

          inline-flex because CtaButton's own `display: flex` is block-level and
          would stretch this across the 900px column the Link never filled.
        */}
        <CtaButton onClick={startNew} style={{display: 'inline-flex', marginTop: SPACING.lg}}>
          + New deck
        </CtaButton>
      </main>

      <NewDeckDialog
        isOpen={newDeckOpen}
        onClose={() => setNewDeckOpen(false)}
        onConfirm={openBuilder}
        // Unsaved work is a loss for anyone, but only a guest is offered the account
        // that would have prevented it; a signed-in user just needed to press Save.
        showReplaceWarning={wouldDiscardWork}
        canKeepBoth={!user}
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
