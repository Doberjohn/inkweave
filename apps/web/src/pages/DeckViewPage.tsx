import {useEffect, useState, type ReactNode} from 'react';
import {Link, useParams} from 'react-router-dom';
import {calculateDeckStats} from '../features/deck/analysis/deckStats';
import {DeckCardGrid} from '../features/deck/components/DeckCardGrid';
import {DeckViewSkeleton} from '../features/deck/components/DeckViewSkeleton';
import {InkIcon} from '../shared/components/InkIcon';
import {getDeck} from '../features/deck/state';
import type {Deck, DeckStats, LorcanaCard} from '../features/deck/types';
import {BackLink, CompactHeader} from '../shared/components';
import {CTA_BASE_STYLE, CTA_FILLED_STYLE} from '../shared/components/ctaStyles';
import {useCardDataContext} from '../shared/contexts/CardDataContext';
import {useCardModal} from '../shared/contexts/CardModalContext';
import {useSession} from '../shared/contexts/SessionContext';
import {useResponsive} from '../shared/hooks';
import {
  COLORS,
  EMPTY_BOX,
  FONTS,
  FONT_SIZES,
  ICON_SIZE,
  LAYOUT,
  SPACING,
  TABULAR,
  TOUCH_TARGET,
} from '../shared/constants';

/** A deck can be saved before it is named; the page still needs something to read. */
const FALLBACK_NAME = 'Untitled deck';

/** Shared with /decks, so the two pages frame their content identically. */
const PAGE_MAX_WIDTH = 1200;

// ── Reading the routed deck ────────────────────────────────────────────────

/** One finished read of `/decks/:id`, tagged with the id it answers. */
interface DeckRead {
  id: string;
  deck: Deck | null;
  /** The read itself failed (network, or Supabase unconfigured), as opposed to finding no row. */
  failed: boolean;
}

/** The stored read, but only when it answers the id currently being displayed. */
function readFor(read: DeckRead | null, id: string | undefined): DeckRead | null {
  return read && read.id === id ? read : null;
}

/**
 * The routed deck, read once per id.
 *
 * A stored result counts only for the id it came from; against any other the page
 * is loading again. Deriving that at render is what lets navigation from one deck
 * URL to another return to the loading state without a synchronous setState inside
 * the effect, which cascades renders and `react-hooks/set-state-in-effect` rejects.
 */
/**
 * Named `useDeckRead`, NOT `useRoutedDeck`: `features/deck/hooks/useRoutedDeck`
 * already exists and does a different job. That one LOADS a routed deck into the
 * shared working draft so the builder can edit it; this one READS a deck for
 * display and never touches the draft, which is the whole point of a view page.
 * Two hooks under one name is a trap for whoever greps next.
 */
function useDeckRead(id: string | undefined) {
  const [read, setRead] = useState<DeckRead | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    void getDeck(id).then(({data, error}) => {
      // Without this, a read that resolves after navigating away sets state for a
      // page nobody is looking at.
      if (!cancelled) setRead({id, deck: data, failed: error !== null});
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const current = readFor(read, id);
  return {
    deck: current?.deck ?? null,
    failed: current?.failed ?? false,
    isLoading: id !== undefined && current === null,
  };
}

// ── Page states ────────────────────────────────────────────────────────────

/** Centered prose: the loading beat, and a read that failed outright. */
function Notice({children, role}: {children: ReactNode; role?: 'alert'}) {
  return (
    <p
      role={role}
      style={{
        margin: 0,
        padding: SPACING.xxxl,
        textAlign: 'center',
        color: COLORS.textMuted,
        fontSize: `${FONT_SIZES.base}px`,
      }}>
      {children}
    </p>
  );
}

/**
 * ONE state for "no such deck" and for "private, and not yours". RLS returns no
 * row in both cases and that ambiguity is deliberate: telling them apart would
 * leak whether an id exists. The wording matches DeckBuilderPage so the two
 * pages agree about what a reader is being told.
 */
function NotFound() {
  return (
    <div style={{padding: SPACING.xxxl, textAlign: 'center'}}>
      <p style={{margin: 0, color: COLORS.textMuted, fontSize: `${FONT_SIZES.base}px`}}>
        Deck not found. It may not exist, or it may be private.
      </p>
    </div>
  );
}

// ── The deck itself ────────────────────────────────────────────────────────

function DeckHeading({deck, totalCards, action}: {deck: Deck; totalCards: number; action?: ReactNode}) {
  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: SPACING.md,
        // The action slot is RESERVED whether or not there is an action. Two things
        // depend on it: the skeleton draws a button and would otherwise hand over an
        // 18px shorter header, and the session resolves after the deck does — so an
        // owner's header would grow under them the moment Edit appeared.
        minHeight: TOUCH_TARGET,
      }}>
      {/*
        Name, inks and count on ONE line (owner ruling 2026-08-07). They were a
        heading with a metadata row beneath, which spent two rows saying what fits
        in one — and the ink CHIPS spelled out "Amethyst" and "Steel" beside symbols
        that already say it on every other surface.
      */}
      <div style={{display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: SPACING.sm, minWidth: 0}}>
      {/*
        Body font, not the hero serif (owner ruling 2026-08-06), matching the deck
        tiles. Weight 700 here rather than the tiles' 600: this IS the page's own
        h1, so it takes PageTitle's weight, while a tile is a card heading inside
        a page whose h1 is "Decks".
      */}
      <h1
        style={{
          fontFamily: FONTS.body,
          fontWeight: 700,
          fontSize: FONT_SIZES.xxl,
          color: COLORS.text,
          margin: 0,
        }}>
          {deck.name.trim() || FALLBACK_NAME}
        </h1>
        {/*
          `decorative={false}` + `showTooltip` because the symbol is now the ONLY
          thing naming the ink here: alt for a screen reader, title for a mouse.
        */}
        <span style={{display: 'flex', alignItems: 'center', gap: SPACING.xs}}>
          {deck.inks.map((ink) => (
            <InkIcon key={ink} ink={ink} size={ICON_SIZE.md} decorative={false} showTooltip />
          ))}
        </span>
        <span style={{...TABULAR, color: COLORS.textMuted, fontSize: `${FONT_SIZES.lg}px`, fontWeight: 600}}>
          {totalCards} {totalCards === 1 ? 'card' : 'cards'}
        </span>
      </div>
      {action}
    </header>
  );
}

/**
 * Legality, but only when it is BAD news.
 *
 * The "Core legal" confirmation is gone (owner ruling 2026-08-07): a legal deck is
 * the overwhelming default, so the line was permanent furniture that said nothing on
 * almost every page it appeared on. A legality PROBLEM still speaks up, because that
 * is the case a reader cannot see for themselves by counting cards.
 */
function Legality({stats}: {stats: DeckStats}) {
  if (stats.isLegal) return null;
  return (
    <div style={{marginTop: SPACING.lg}}>
      <p style={{margin: 0, fontSize: `${FONT_SIZES.base}px`, fontWeight: 600, color: COLORS.error}}>Not Core legal</p>
      <ul
        style={{
          margin: `${SPACING.xs}px 0 0`,
          paddingLeft: SPACING.xl,
          color: COLORS.textMuted,
          fontSize: `${FONT_SIZES.base}px`,
        }}>
        {stats.legalityErrors.map((problem) => (
          <li key={problem}>{problem}</li>
        ))}
      </ul>
    </div>
  );
}

/** A resolved deck line: the card, and how many copies of it the deck runs. */
interface CardLine {
  card: LorcanaCard;
  quantity: number;
}

function cardName(card: LorcanaCard): string {
  return card.fullName || card.name;
}

/**
 * Deck lines resolved and sorted by cost, then name: the builder's own order, so
 * a deck reads the same whether you are editing it or looking at it. Ids that no
 * longer resolve are dropped here, and calculateDeckStats surfaces them as
 * warnings instead.
 */
function buildCardLines(deck: Deck, getCardById: (id: string) => LorcanaCard | undefined): CardLine[] {
  return deck.cards
    .flatMap((entry) => {
      const card = getCardById(entry.cardId);
      return card ? [{card, quantity: entry.quantity}] : [];
    })
    .sort((a, b) => a.card.cost - b.card.cost || cardName(a.card).localeCompare(cardName(b.card)));
}

/**
 * The deck itself, as cards.
 *
 * Was a text list of names, which is a lookup table — you read it. The grid is the
 * deck: a player recognises their own list from the art long before they could read
 * twenty names, and the copies badge is the only fact the deck knows that the printed
 * card does not.
 */
function DeckCardList({lines, onSelectCard}: {lines: CardLine[]; onSelectCard: (card: LorcanaCard) => void}) {
  if (lines.length === 0) {
    return (
      <div
        style={{
          ...EMPTY_BOX,
          marginTop: SPACING.xxl,
          padding: SPACING.xxxl,
          fontFamily: FONTS.body,
          fontSize: `${FONT_SIZES.base}px`,
        }}>
        This deck has no cards in it yet.
      </div>
    );
  }
  return <DeckCardGrid lines={lines} onSelectCard={onSelectCard} />;
}

// ── Owner controls ─────────────────────────────────────────────────────────

/**
 * An anchor, not a button: `/decks/:id/edit` is a real URL, and middle-click plus
 * open-in-new-tab are exactly what an owner reaches for on their own deck. It wears
 * the kit's base AND filled recipes by hand, because CtaButton is a `<button>` by
 * construction and so can never be this.
 *
 * Filled rather than ghost (owner ruling 2026-08-07): it is now the only action on
 * the page, and the primary action wears the primary paint. It sits in the heading
 * row for the same reason "+ New deck" does on /decks — the page's one verb, level
 * with the page's name.
 */
function EditLink({deckId}: {deckId: string}) {
  return (
    <Link to={`/decks/${deckId}/edit`} style={{...CTA_BASE_STYLE, ...CTA_FILLED_STYLE, display: 'inline-flex'}}>
      Edit deck
    </Link>
  );
}

// ── The page ───────────────────────────────────────────────────────────────

/** The shell every state renders into, so a notice sits where the deck would. */
function PageShell({children}: {children: ReactNode}) {
  const {isMobile} = useResponsive();
  return (
    <>
      <CompactHeader isMobile={isMobile} />
      <main
        style={{
          minHeight: `calc(100vh - ${LAYOUT.compactHeaderHeight}px)`,
          background: COLORS.background,
          padding: SPACING.xl,
          // Matches /decks (owner ruling 2026-08-07). The old 900 was a reading
        // measure for the text decklist this page used to be; it is a card grid now,
        // and the measure caps how many cards you can take in at once.
        maxWidth: PAGE_MAX_WIDTH,
          margin: '0 auto',
          fontFamily: FONTS.body,
        }}>
        {/*
          The way out, rendered by the SHELL rather than by the loaded deck.
          It depends on no data, so putting it here means it paints with the first
          frame instead of pushing the page down 44px when the deck arrives — which
          is exactly what it did, measured, once it was added after the skeleton was
          tuned to 0px.
          
          It also means the failed-read and not-found states get a way out, which
          the error state did not have at all.
        */}
        <BackLink to="/decks" label="Back to decks" />
        {children}
      </main>
    </>
  );
}

/** Ownership: the only thing that unlocks Edit and the visibility control. */
function ownsDeck(deck: Deck, userId: string | undefined): boolean {
  return userId !== undefined && deck.ownerId === userId;
}

/**
 * Everything the first paint waits on.
 *
 * Card names AND legality both come out of the card database, so rendering early
 * shows a deck of unknown cards that reads as illegal. The session decides WHICH
 * page this is, so rendering before it resolves shows an owner the visitor's view
 * and then swaps it under them.
 */
function isResolving(gates: {deck: boolean; cards: boolean; session: boolean}): boolean {
  return gates.deck || gates.cards || gates.session;
}

/**
 * `/decks/:id` (#473) — the read-only deck, and the page a shared link lands on.
 *
 * A visitor gets the deck and the share button. Its owner also gets Edit and the
 * visibility control, which is the point of the whole page: it is what turns a
 * saved deck into one anybody can open.
 */
export function DeckViewPage() {
  const {id} = useParams();
  const {user, loading: authLoading} = useSession();
  const {getCardById, isLoading: cardsLoading} = useCardDataContext();
  const {openCardModal} = useCardModal();
  const {deck, failed, isLoading} = useDeckRead(id);

  if (isResolving({deck: isLoading, cards: cardsLoading, session: authLoading})) {
    return (
      <PageShell>
        <DeckViewSkeleton />
      </PageShell>
    );
  }
  // A read that failed is not a deck that is missing, and must not borrow its
  // wording: one is worth retrying, the other never will be.
  if (failed) {
    return (
      <PageShell>
        <Notice role="alert">We could not load this deck. Check your connection and try again.</Notice>
      </PageShell>
    );
  }
  if (!deck) {
    return (
      <PageShell>
        <NotFound />
      </PageShell>
    );
  }

  const stats = calculateDeckStats(deck, getCardById);
  // Resolved once: the grid renders this order and the modal walks the same one, so
  // "next card" means what the eye just saw rather than a second, private ordering.
  const lines = buildCardLines(deck, getCardById);
  const isOwner = ownsDeck(deck, user?.id);

  return (
    <PageShell>
      <DeckHeading
        deck={deck}
        totalCards={stats.totalCards}
        action={isOwner ? <EditLink deckId={deck.id} /> : undefined}
      />
      <Legality stats={stats} />
      {/*
        The modal is given the whole deck as siblings, so its prev/next walks the
        deck in the order shown rather than dropping you on an island. That is what
        makes tapping into a card cheap: you can read the whole list without going
        back to the grid between each one.
      */}
      <DeckCardList
        lines={lines}
        onSelectCard={(card) => openCardModal(card.id, lines.map((line) => line.card.id))}
      />
    </PageShell>
  );
}
