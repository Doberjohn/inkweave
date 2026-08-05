import {useEffect, useState, type ReactNode} from 'react';
import {Link, useParams} from 'react-router-dom';
import {calculateDeckStats} from '../features/deck/analysis/deckStats';
import {CostGlyph} from '../features/deck/components/CostGlyph';
import {InkChip} from '../features/deck/components/InkChip';
import {ShareDeckButton} from '../features/deck/components/ShareDeckButton';
import {getDeck, updateDeck} from '../features/deck/state';
import type {Deck, DeckStats, LorcanaCard} from '../features/deck/types';
import {CompactHeader, CtaButton} from '../shared/components';
import {CTA_BASE_STYLE} from '../shared/components/ctaStyles';
import {useCardDataContext} from '../shared/contexts/CardDataContext';
import {useSession} from '../shared/contexts/SessionContext';
import {useResponsive} from '../shared/hooks';
import {
  COLORS,
  EMPTY_BOX,
  FONTS,
  FONT_SIZES,
  INK_COLORS,
  LAYOUT,
  RADIUS,
  SPACING,
  SURFACE_CARD,
  TABULAR,
  TRUNCATE,
  hexRgba,
} from '../shared/constants';

/** A deck can be saved before it is named; the page still needs something to read. */
const FALLBACK_NAME = 'Untitled deck';

/**
 * Each half says what the OFFERED action would do, not just which state the deck
 * is in. A switch labelled "public" tells an owner nothing about who is about to
 * be able to read their deck.
 */
const VISIBILITY_COPY = {
  public: 'Public. Anyone can see this deck, and it appears in community decks. Making it private hides it again.',
  private:
    'Private. Only you can see this deck. Publishing it means anyone can see it, and it appears in community decks.',
} as const;

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
    /** Adopt a row the server just returned, so a visibility write shows immediately. */
    adopt: (next: Deck) => setRead({id: next.id, deck: next, failed: false}),
  };
}

/** Where a visibility write stands: nothing in flight, one in flight, or one that failed. */
type SaveState = 'idle' | 'saving' | 'failed';

/** A visibility write, tagged with the deck it was made against. */
interface SaveAttempt {
  deckId: string;
  state: SaveState;
}

/**
 * The visibility write, shared by the toggle and the share button's publish offer
 * so those two can never disagree about what the deck is.
 *
 * A failed write leaves the deck on screen exactly as the server still has it. A
 * publish that did not land must not read as published, or the owner hands out a
 * link to a deck nobody else can open.
 */
function useVisibility(deck: Deck | null, adopt: (deck: Deck) => void) {
  const [attempt, setAttempt] = useState<SaveAttempt | null>(null);

  const setPublic = async (isPublic: boolean): Promise<boolean> => {
    if (!deck) return false;
    setAttempt({deckId: deck.id, state: 'saving'});
    const {data} = await updateDeck({...deck, isPublic});
    // A null row with no error counts as failure too: there is no confirmed new
    // state to show, so claiming one would be a guess.
    if (!data) {
      setAttempt({deckId: deck.id, state: 'failed'});
      return false;
    }
    adopt(data);
    setAttempt(null);
    return true;
  };

  // Tagged with its deck for the same reason the read is: this page is NOT
  // remounted when `:id` changes, so an untagged failure would follow the reader
  // to the next deck and complain about a write that deck never saw.
  const saveState: SaveState = attempt?.deckId === deck?.id ? (attempt?.state ?? 'idle') : 'idle';
  return {saveState, setPublic};
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
      <Link
        to="/decks"
        style={{
          display: 'inline-block',
          marginTop: SPACING.lg,
          color: COLORS.primary,
          fontFamily: FONTS.body,
          fontSize: `${FONT_SIZES.base}px`,
          fontWeight: 600,
        }}>
        Back to decks
      </Link>
    </div>
  );
}

// ── The deck itself ────────────────────────────────────────────────────────

function DeckHeading({deck, totalCards}: {deck: Deck; totalCards: number}) {
  return (
    <header>
      <h1 style={{fontFamily: FONTS.hero, fontSize: FONT_SIZES.xxl, color: COLORS.text, margin: 0}}>
        {deck.name.trim() || FALLBACK_NAME}
      </h1>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: SPACING.sm,
          marginTop: SPACING.sm,
        }}>
        {deck.inks.map((ink) => (
          <InkChip key={ink} ink={ink} />
        ))}
        <span
          style={{
            ...TABULAR,
            color: COLORS.textMuted,
            fontSize: `${FONT_SIZES.lg}px`,
            fontWeight: 600,
          }}>
          {totalCards} {totalCards === 1 ? 'card' : 'cards'}
        </span>
      </div>
    </header>
  );
}

/**
 * Legality, stated either way.
 *
 * The builder stays silent on a legal deck, because there the absence of a
 * complaint means "fine" to the person who just built it. A reader who did not
 * build this one has no such context, so the happy case says so out loud.
 */
function Legality({stats}: {stats: DeckStats}) {
  if (stats.isLegal) {
    return (
      <p
        style={{
          margin: `${SPACING.lg}px 0 0`,
          fontSize: `${FONT_SIZES.base}px`,
          fontWeight: 600,
          color: COLORS.success,
        }}>
        Core legal
      </p>
    );
  }
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
 * One read-only line: copies, cost, name. Deliberately NOT DeckCardRow, which is
 * the builder's editable row and requires increment/decrement handlers. Passing
 * it no-op handlers would render a stepper that quietly does nothing.
 */
function DeckLine({card, quantity}: CardLine) {
  return (
    <li
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: SPACING.md,
        minWidth: 0,
        padding: `${SPACING.xs}px ${SPACING.sm}px`,
        borderRadius: `${RADIUS.sm}px`,
        // The card's own ink as a left edge: the list's only grouping cue, now
        // that there is no stepper anchoring the right-hand side.
        borderLeft: `3px solid ${INK_COLORS[card.ink].border}`,
        background: COLORS.surfaceAlt,
      }}>
      <span
        style={{
          ...TABULAR,
          flexShrink: 0,
          color: COLORS.textMuted,
          fontSize: `${FONT_SIZES.lg}px`,
          fontWeight: 600,
        }}>
        {quantity}x
      </span>
      <CostGlyph cost={card.cost} inkwell={card.inkwell} size={24} />
      <span style={{...TRUNCATE, flex: 1, minWidth: 0, color: COLORS.text, fontSize: `${FONT_SIZES.lg}px`}}>
        {cardName(card)}
      </span>
    </li>
  );
}

function DeckCardList({lines}: {lines: CardLine[]}) {
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
  return (
    <ul
      aria-label="Deck list"
      style={{
        listStyle: 'none',
        margin: `${SPACING.xxl}px 0 0`,
        padding: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: SPACING.xs,
      }}>
      {lines.map((line) => (
        <DeckLine key={line.card.id} card={line.card} quantity={line.quantity} />
      ))}
    </ul>
  );
}

// ── Owner controls ─────────────────────────────────────────────────────────

/**
 * An anchor, not a button: `/decks/:id/edit` is a real URL, and middle-click plus
 * open-in-new-tab are exactly what an owner reaches for on their own deck. It
 * wears the kit's base recipe with the ghost paint by hand, because CtaButton is
 * a `<button>` by construction and so can never be this.
 */
function EditLink({deckId}: {deckId: string}) {
  return (
    <Link
      to={`/decks/${deckId}/edit`}
      style={{
        ...CTA_BASE_STYLE,
        display: 'inline-flex',
        background: 'transparent',
        color: COLORS.primary,
        border: `1px solid ${hexRgba(COLORS.primary, 0.4)}`,
      }}>
      Edit deck
    </Link>
  );
}

/** The button's label: the write in flight is the only thing that displaces it. */
function visibilityAction(isPublic: boolean, saving: boolean): string {
  if (saving) return 'Saving…';
  return isPublic ? 'Make private' : 'Publish deck';
}

interface VisibilityControlProps {
  isPublic: boolean;
  saveState: SaveState;
  onSetPublic: (isPublic: boolean) => Promise<boolean>;
}

/** Who can see this deck, in a sentence, with the one control that changes it. */
function VisibilityControl({isPublic, saveState, onSetPublic}: VisibilityControlProps) {
  const saving = saveState === 'saving';
  return (
    <div>
      <p style={{margin: 0, color: COLORS.textMuted, fontSize: `${FONT_SIZES.base}px`, lineHeight: 1.6}}>
        {isPublic ? VISIBILITY_COPY.public : VISIBILITY_COPY.private}
      </p>
      <CtaButton
        variant="neutral"
        onClick={() => void onSetPublic(!isPublic)}
        disabled={saving}
        style={{display: 'inline-flex', marginTop: SPACING.sm}}>
        {visibilityAction(isPublic, saving)}
      </CtaButton>
      {/* The deck above still reads the way the server has it, so this says what
          did NOT happen rather than leaving a silently unchanged toggle. */}
      {saveState === 'failed' && (
        <p
          role="alert"
          style={{margin: `${SPACING.sm}px 0 0`, color: COLORS.error, fontSize: `${FONT_SIZES.base}px`}}>
          Could not change who can see this deck. Nothing changed, so it is still {isPublic ? 'public' : 'private'}. Try
          again in a moment.
        </p>
      )}
    </div>
  );
}

interface OwnerControlsProps {
  deck: Deck;
  saveState: SaveState;
  onSetPublic: (isPublic: boolean) => Promise<boolean>;
}

/**
 * Everything only an owner may do, on one surface with the share button, so that
 * "who can see this" sits beside the control that hands the link out.
 */
function OwnerControls({deck, saveState, onSetPublic}: OwnerControlsProps) {
  return (
    <section
      aria-label="Deck owner controls"
      style={{
        ...SURFACE_CARD,
        marginTop: SPACING.xl,
        display: 'flex',
        flexDirection: 'column',
        gap: SPACING.lg,
      }}>
      <div style={{display: 'flex', alignItems: 'flex-start', flexWrap: 'wrap', gap: SPACING.sm}}>
        <ShareDeckButton deck={deck} onPublish={() => onSetPublic(true)} />
        <EditLink deckId={deck.id} />
      </div>
      <VisibilityControl isPublic={Boolean(deck.isPublic)} saveState={saveState} onSetPublic={onSetPublic} />
    </section>
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
          maxWidth: 900,
          margin: '0 auto',
          fontFamily: FONTS.body,
        }}>
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
  const {deck, failed, isLoading, adopt} = useDeckRead(id);
  const {saveState, setPublic} = useVisibility(deck, adopt);

  if (isResolving({deck: isLoading, cards: cardsLoading, session: authLoading})) {
    return (
      <PageShell>
        <Notice>Loading deck…</Notice>
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

  return (
    <PageShell>
      <DeckHeading deck={deck} totalCards={stats.totalCards} />
      <Legality stats={stats} />
      {ownsDeck(deck, user?.id) ? (
        <OwnerControls deck={deck} saveState={saveState} onSetPublic={setPublic} />
      ) : (
        <div style={{marginTop: SPACING.xl}}>
          <ShareDeckButton deck={deck} />
        </div>
      )}
      <DeckCardList lines={buildCardLines(deck, getCardById)} />
    </PageShell>
  );
}
