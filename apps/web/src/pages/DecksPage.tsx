import {useEffect, useState, type ReactNode} from 'react';
import {useNavigate} from 'react-router-dom';
import {AuthButton, CompactHeader, CtaButton, TabList, headerCarriesAuth} from '../shared/components';
import type {ViewportConfig} from '../shared/components';
import {SignInDialog} from '../shared/components/SignInDialog';
import {DeckListSkeleton} from '../features/deck/components/DeckListSkeleton';
import {DeckSummaryCard} from '../features/deck/components/DeckSummaryCard';
import {DECK_TILE_GAP, DECK_TILE_MIN_WIDTH} from '../features/deck/components/deckGrid';
import {NewDeckDialog} from '../features/deck/components/NewDeckDialog';
import {calculateDeckStats} from '../features/deck/analysis/deckStats';
import {listDecks, listPublicDecks, useDeck, type RepoResult} from '../features/deck/state';
import {signatureCard} from '../features/deck/components/signatureCard';
import {DisplayNameDialog, getAuthorNames, useProfile} from '../features/profile';
import type {Deck} from '../features/deck/types';
import type {LorcanaCard} from '../features/cards';
import {useCardDataContext} from '../shared/contexts/CardDataContext';
import {useResponsive} from '../shared/hooks';
import {useSession} from '../shared/contexts/SessionContext';
import {COLORS, EMPTY_BOX, FONTS, FONT_SIZES, LAYOUT, RADIUS, SPACING} from '../shared/constants';

type CardLookup = (id: string) => LorcanaCard | undefined;

// Labels follow the owner's 2026-08-01 wording ("Yours / community"): the strip
// sits under the page's own "Decks" heading, so neither label repeats the noun.
const TABS = [
  {id: 'community', label: 'Community'},
  {id: 'mine', label: 'Yours'},
] as const;

type DecksTab = (typeof TABS)[number]['id'];

/**
 * Whether /decks renders its OWN sign in / sign out control beside the heading.
 *
 * Owner ruling 2026-08-05: mobile auth lives here, as one button, because
 * `CompactHeader` renders nothing on mobile and takes its `AuthButton` with it.
 * This page is the fallback for exactly the viewports the header abandons.
 *
 * Written as the negation of `headerCarriesAuth` rather than as `isMobile`, which
 * is the same value today. The trap: on a viewport where the header DOES carry
 * auth, returning true here puts two controls both named "Sign in" on one page,
 * and nothing in the suite would catch it. Deriving from the header's own rule
 * makes that state unreachable instead of merely unlikely.
 */
function showsOwnAuthControl(viewport: ViewportConfig): boolean {
  return !headerCarriesAuth(viewport);
}

// ── Reading a deck list ────────────────────────────────────────────────────

/**
 * A deck-list read, in the three states that must stay distinguishable. Folding
 * `failed` into an empty `decks` would render a network failure as "nobody has
 * published yet" — a lie, and one the reader cannot act on.
 */
interface DeckListState {
  /** The rows, or null while the read is in flight or has failed. */
  decks: Deck[] | null;
  failed: boolean;
}

const LOADING: DeckListState = {decks: null, failed: false};

/** A finished read, tagged with the read it answers (owner + attempt). */
interface KeyedResult {
  key: string;
  state: DeckListState;
}

function toListState({data, error}: RepoResult<Deck[]>): DeckListState {
  return error || !data ? {decks: null, failed: true} : {decks: data, failed: false};
}

/**
 * A stored result counts only for the read it came from; against any other key the
 * list is loading again. Deriving that at render is what lets a retry (or a change
 * of owner) return to the loading state without a synchronous setState inside the
 * effect, which cascades renders and `react-hooks/set-state-in-effect` rejects.
 */
function stateFor(result: KeyedResult | null, key: string): DeckListState {
  return result?.key === key ? result.state : LOADING;
}

/**
 * Which list to read, as a plain string so it can be an effect dependency without
 * the identity churn an object literal would bring: the community feed, one owner's
 * saved decks, or nothing at all (a signed-out visitor has no saved decks to read).
 */
type DeckSource = 'public' | `own:${string}` | '';

function readDecks(source: DeckSource): Promise<RepoResult<Deck[]>> | null {
  if (source === 'public') return listPublicDecks();
  return source === '' ? null : listDecks(source.slice('own:'.length));
}

/** A counter whose bump re-runs a fetching effect — what makes a retry possible. */
function useReload(): [number, () => void] {
  const [attempt, setAttempt] = useState(0);
  return [attempt, () => setAttempt((n) => n + 1)];
}

/**
 * The display name of each deck's owner, keyed by owner id.
 *
 * A second read rather than a join. `decks.owner_id` references `auth.users`, not
 * `profiles`, so PostgREST has no foreign key to embed across — and adding one would
 * fail against the accounts that predate the profiles table and still have no row.
 *
 * Keyed on the joined owner ids, so it refetches when the LIST changes rather than on
 * every render, and the empty map it starts from is why the tiles render immediately
 * and gain their authors a beat later instead of blocking on this.
 */
function useAuthorNames(decks: Deck[] | null): Map<string, string> {
  const [names, setNames] = useState<Map<string, string>>(EMPTY_NAMES);
  const ownerIds = decks ? [...new Set(decks.map((deck) => deck.ownerId).filter((id): id is string => Boolean(id)))] : [];
  const key = ownerIds.join(',');

  useEffect(() => {
    if (key === '') return;
    let active = true;
    void getAuthorNames(key.split(',')).then(({data}) => {
      if (active && data) setNames(data);
    });
    return () => {
      active = false;
    };
  }, [key]);

  return names;
}

/** Module-level so the initial state is referentially stable across renders. */
const EMPTY_NAMES: Map<string, string> = new Map();

/**
 * One deck list, read once per `source` (and once more per retry). Both tabs share
 * this: the reads differ only in which repository call they make, and the loading /
 * loaded / failed bookkeeping around them is identical.
 *
 * The community read works signed out — RLS already permits anon on public rows.
 */
function useDeckList(source: DeckSource): DeckListState & {retry: () => void} {
  const [attempt, retry] = useReload();
  const [result, setResult] = useState<KeyedResult | null>(null);
  const key = `${source}#${attempt}`;

  useEffect(() => {
    const request = readDecks(source);
    if (!request) return;
    let active = true;
    void request.then((repoResult) => {
      if (active) setResult({key, state: toListState(repoResult)});
    });
    return () => {
      active = false;
    };
  }, [source, key]);

  return {...stateFor(result, key), retry};
}

// ── List states ────────────────────────────────────────────────────────────

/** The house empty-state recipe, sized for a full-width list slot. */
function EmptyNote({children}: {children: ReactNode}) {
  return (
    <div
      style={{
        ...EMPTY_BOX,
        padding: SPACING.xxxl,
        fontFamily: FONTS.body,
        fontSize: `${FONT_SIZES.base}px`,
        lineHeight: 1.6,
      }}>
      {/* One child on purpose: EMPTY_BOX centers with flex, so a sentence mixing
          text and <strong> would otherwise become several flex items side by side
          instead of one wrapping paragraph. */}
      <span style={{maxWidth: 420}}>{children}</span>
    </div>
  );
}

/**
 * A failed read, deliberately NOT the empty box: solid and error-tinted where the
 * empty state is dashed and muted, and carrying the retry an empty list has no use
 * for. "Nothing here" and "we could not look" must never render the same.
 */
function LoadFailure({what, onRetry}: {what: string; onRetry: () => void}) {
  return (
    <div
      role="alert"
      style={{
        background: COLORS.errorBg,
        border: `1px solid ${COLORS.errorBorder}`,
        borderRadius: `${RADIUS.lg}px`,
        padding: SPACING.xl,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: SPACING.lg,
        textAlign: 'center',
        fontFamily: FONTS.body,
        fontSize: `${FONT_SIZES.base}px`,
        color: COLORS.text,
      }}>
      <span>We could not load {what}. Check your connection and try again.</span>
      <CtaButton variant="neutral" onClick={onRetry}>
        Try again
      </CtaButton>
    </div>
  );
}

/** The list itself: one summary row per deck. */

/**
 * Wider than the 900px its sibling pages use, deliberately.
 *
 * 900 is a reading measure and it is right for `DeckViewPage`, which is a
 * 60-line card list you read top to bottom. This page is a browse grid, where
 * the measure caps how many decks you can compare at once: at 900 it is three
 * tiles per row on any monitor, at 1200 it is four. Raised by owner request
 * once the rows became tiles.
 */
const PAGE_MAX_WIDTH = 1200;

function DeckList({
  decks,
  hrefFor,
  names,
  getCardById,
}: {
  decks: Deck[];
  hrefFor?: (deck: Deck) => string;
  /** Owner id -> display name. Absent on your own list, where every deck is yours. */
  names?: Map<string, string>;
  /**
   * Resolves the deck's signature card for the frame's art window. Optional because
   * the card database may still be loading, and a card with an empty window is a
   * better intermediate state than no card at all.
   */
  getCardById?: CardLookup;
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(auto-fill, minmax(${DECK_TILE_MIN_WIDTH}px, 1fr))`,
        gap: DECK_TILE_GAP,
      }}>
      {decks.map((deck) => (
        <DeckSummaryCard
          key={deck.id}
          deck={deck}
          to={hrefFor?.(deck)}
          authorName={deck.ownerId ? names?.get(deck.ownerId) : undefined}
          artUrl={getCardById && signatureCard(deck, getCardById)?.imageUrl}
        />
      ))}
    </div>
  );
}

// ── The two tabs ───────────────────────────────────────────────────────────

interface CommunityTabProps {
  list: DeckListState & {retry: () => void};
  /** False while the card database is still resolving. */
  cardsReady: boolean;
  getCardById: CardLookup;
  /** Owner id -> display name, filled in a beat after the tiles render. */
  names: Map<string, string>;
}

/**
 * Public decks, filtered to the legal ones for display.
 *
 * The filter is client-side because legality needs per-card ink and identity from
 * `allCards.json`, and a `decks` row stores only `{cardId, quantity}` — there is
 * nothing in the database to filter on. It waits for the card database, since
 * every deck reads as illegal while `getCardById` still resolves nothing.
 */
function CommunityTab({list, cardsReady, getCardById, names}: CommunityTabProps) {
  if (list.failed) return <LoadFailure what="community decks" onRetry={list.retry} />;
  if (list.decks === null || !cardsReady) return <DeckListSkeleton ariaLabel="Loading community decks" />;

  const legal = list.decks.filter((deck) => calculateDeckStats(deck, getCardById).isLegal);
  if (legal.length === 0) {
    return (
      <EmptyNote>
        No decks have been shared yet. Build one with <strong>+ New deck</strong>, set it to{' '}
        <strong>Public</strong> while you build, and it lands here once you save a Core-legal 60.
      </EmptyNote>
    );
  }
  return <DeckList decks={legal} names={names} getCardById={getCardById} />;
}

/**
 * Who your published decks appear as, with the way to change it.
 *
 * It lives in "Yours" rather than the header because that is where it is TRUE: this
 * tab is the only place the name is yours rather than someone else's. It also has to
 * work on mobile, and `CompactHeader` renders nothing there.
 *
 * Renders nothing until the identity resolves. A placeholder would be worse than an
 * absence: the row exists to tell you a specific name, and briefly showing a
 * different one is the one thing it must not do.
 */
function PublishingAs({userId}: {userId: string}) {
  const {identity, adoptDisplayName} = useProfile();
  const [open, setOpen] = useState(false);
  if (!identity) return null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: SPACING.sm,
        marginBottom: SPACING.lg,
        fontFamily: FONTS.body,
        fontSize: `${FONT_SIZES.sm}px`,
        color: COLORS.textMuted,
      }}>
      {/*
        The DISPLAY name, which is what a reader of your decks sees. The handle is
        not shown: nothing renders it yet, and putting an identifier beside the name
        here would imply the two are interchangeable when only one is unique.
      */}
      <span>
        You publish as <strong style={{color: COLORS.text}}>{identity.displayName}</strong>
      </span>
      <CtaButton variant="ghost" onClick={() => setOpen(true)}>
        Change
      </CtaButton>
      <DisplayNameDialog
        isOpen={open}
        onClose={() => setOpen(false)}
        userId={userId}
        current={identity.displayName}
        onSaved={adoptDisplayName}
      />
    </div>
  );
}

/** The signed-in half of "Yours": whatever the account has saved. */
function SavedDecks({list}: {list: DeckListState & {retry: () => void}}) {
  if (list.failed) return <LoadFailure what="your decks" onRetry={list.retry} />;
  // Four, not eight: your own list is usually short, and a screenful of
  // placeholders for two decks promises more than arrives.
  if (list.decks === null) return <DeckListSkeleton count={4} ariaLabel="Loading your decks" />;
  if (list.decks.length === 0) {
    return <EmptyNote>Nothing saved yet. Decks you save appear here, on every device you sign in on.</EmptyNote>;
  }
  return <DeckList decks={list.decks} />;
}

/**
 * Signed in, this is the account's saved decks. Signed out, it is the one local
 * draft — the builder works fully without an account, so a guest still has decks
 * to list, they just live in this browser.
 */
function MyDecksTab({
  list,
  userId,
  draft,
}: {
  list: DeckListState & {retry: () => void};
  /** The signed-in user, or null for a guest working from a local draft. */
  userId: string | null;
  draft: Deck;
}) {
  if (userId) {
    return (
      <>
        <PublishingAs userId={userId} />
        <SavedDecks list={list} />
      </>
    );
  }
  // An unsaved draft has no cloud row, so /decks/:id would find nothing; the
  // builder holds it in context already and is the honest destination.
  if (draft.cards.length > 0) return <DeckList decks={[draft]} hrefFor={() => '/decks/new'} />;
  return (
    <EmptyNote>
      Decks you build are kept in this browser. Start one with <strong>+ New deck</strong> above; signing in later keeps
      it and carries it to your other devices.
    </EmptyNote>
  );
}

/**
 * `/decks` — the community deck hub, with your own decks as a tab within it
 * (owner ruling 2026-08-01, PLAN.md Phase 1). NOT an account-scoped page: that
 * reading is what put Decks in the desktop nav beside Browse/Playstyles/Vote,
 * and it is why there is no `/decks/feed` (#454's route moved here).
 *
 * Community is the default tab for everyone, signed in or not: the page's identity
 * is the shared feed, and "yours" is the detour.
 */
export function DecksPage() {
  const {isMobile} = useResponsive();
  const {deck, isDirty, startNewDeck} = useDeck();
  const {user} = useSession();
  const {getCardById, isLoading} = useCardDataContext();
  const navigate = useNavigate();
  const [tab, setTab] = useState<DecksTab>('community');
  const [newDeckOpen, setNewDeckOpen] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);
  const community = useDeckList('public');
  const own = useDeckList(user ? `own:${user.id}` : '');
  // Community only. On "Yours" every deck is yours, so stamping each tile with your
  // own name is noise — and skipping it also skips the query.
  const authorNames = useAuthorNames(community.decks);

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
          maxWidth: PAGE_MAX_WIDTH,
          margin: '0 auto',
        }}>
        {/*
          The heading shares its row with the page's actions. Baseline is
          deliberately NOT aligned: the hero-serif heading and a 44px button have
          nothing in common to align on, so they center against each other.

          The action cluster wraps rather than shrinks, because at narrow widths
          two buttons beside a serif heading run out of room before either button
          can afford to lose a word.
        */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: SPACING.md,
          }}>
          {/*
            Body font at 700, matching DeckViewPage's heading (owner ruling
            2026-08-07). The hero serif made the two pages read as different
            products when one is just a detail view of the other.
          */}
          <h1 style={{fontFamily: FONTS.body, fontWeight: 700, fontSize: FONT_SIZES.xxl, color: COLORS.text, margin: 0}}>
            Decks
          </h1>
          <div style={{display: 'flex', alignItems: 'center', gap: SPACING.sm}}>
            {/* Auth first, so the filled primary stays rightmost, as it is in the deck toolbar. */}
            {showsOwnAuthControl({isMobile}) && <AuthButton onSignIn={() => setSignInOpen(true)} />}
            {/*
              This was a <Link> spreading the kit's filled CTA, and the anchor was
              deliberate: middle-click, open-in-new-tab and crawlability all
              mattered. Creating a deck can now stop to ask a question, and a
              dialog cannot intervene in a native navigation, so those affordances
              are given up here deliberately rather than overlooked. /decks/new
              stays reachable by URL.

              inline-flex because CtaButton's own `display: flex` is block-level
              and would stretch this across the row.
            */}
            <CtaButton onClick={startNew} style={{display: 'inline-flex'}}>
              + New deck
            </CtaButton>
          </div>
        </div>


        <div style={{marginTop: SPACING.xxl, borderRadius: `${RADIUS.lg}px`, overflow: 'hidden'}}>
          <TabList tabs={TABS} active={tab} onChange={setTab} ariaLabel="Deck lists" />
        </div>
        <div style={{marginTop: SPACING.lg}}>
          {tab === 'community' ? (
            <CommunityTab list={community} cardsReady={!isLoading} getCardById={getCardById} names={authorNames} />
          ) : (
            <MyDecksTab list={own} userId={user?.id ?? null} draft={deck} />
          )}
        </div>
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
