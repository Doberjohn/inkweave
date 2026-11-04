import {useEffect, useId, useRef, useState, type CSSProperties, type RefObject} from 'react';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {CtaButton} from '../../../shared/components';
import {trackEvent} from '../../../shared/lib/analytics';
import {
  COLORS,
  DIALOG_TITLE,
  DURATION,
  EASING,
  FONT_SIZES,
  FONT_WEIGHT,
  GOLD_GLOW,
  RADIUS,
  SPACING,
  TRUNCATE,
  whiteRgba,
} from '../../../shared/constants';
import {searchCardsByName, smallImageUrl} from '../../cards/loader';
import type {CollectionEntries} from '../collectionParser';
import {AskDialog, ProblemLine, WhenGone} from './binderDialogs';
import {cardsOf, coverChoices} from './binderCovers';
import {FIELD, HEADING, LEAD} from './binderFields';
import {BinderMedal} from './BinderMedal';
import type {Binder} from './binderRules';
import {setCover, type CoverResult} from './binderShelf';
import {MY_COLLECTION} from './shelfWords';
import './coverPicker.css';

export interface CoverPickerProps {
  isOpen: boolean;
  /** The binder whose cover changes, or null for My collection. Kept while the picker closes. */
  binder: Binder | null;
  /** My collection's cover as the shelf holds it: the card picked, or null for the rarest. */
  shelfCover: string | null;
  /** Every card a binder can hold. */
  pool: readonly LorcanaCard[];
  entries: CollectionEntries;
  /** Whose shelf: the save waits in their write queue. */
  readerId: string;
  isMobile: boolean;
  /** Told once the server has the cover; the caller closes the picker. */
  onSaved: () => void;
  onClose: () => void;
  /** Told once a closed picker's exit has run, so the shelf can unmount it. */
  onGone: () => void;
}

/** What the picker is called: our words, never the binder's name, which stays out of attributes. */
const DIALOG_NAME = 'Change cover';

/** How many cards show at first, and how many more each Show more adds. */
export const COVER_PAGE = 40;

/** Why a pick didn't land. */
type CoverProblem = Exclude<CoverResult, 'set'>;

const FAILED_WORDS = "Couldn't change the cover. Try again.";

/**
 * The pick, and what it came to. While it runs every way out waits, since the picker alone would
 * say it failed; picking the cover it has already only closes.
 */
function useCoverSave({readerId, binder, onSaved}: Pick<CoverPickerProps, 'readerId' | 'binder' | 'onSaved'>) {
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<CoverProblem | null>(null);
  const pick = async (coverId: string | null) => {
    setSaving(true);
    setProblem(null);
    const result = await setCover({readerId, id: binder?.id ?? null, coverId});
    setSaving(false);
    if (result !== 'set') {
      setProblem(result);
      return;
    }
    trackEvent('binder_changed', {what: 'cover'});
    onSaved();
  };
  return {saving, problem, pick};
}

/**
 * The cards on show: those Find a card's words name, 40 at a time. Show more hands focus to the
 * first card it adds, since the button may leave with the last of them.
 */
function useShownCards(choices: LorcanaCard[], listRef: RefObject<HTMLUListElement | null>) {
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(COVER_PAGE);
  const [focusAt, setFocusAt] = useState<number | null>(null);
  useEffect(() => {
    if (focusAt !== null) listRef.current?.querySelectorAll('button')[focusAt]?.focus();
  }, [focusAt, listRef]);
  const found = query.trim() === '' ? choices : searchCardsByName(choices, query);
  return {
    query,
    find: (words: string) => {
      setQuery(words);
      setLimit(COVER_PAGE);
      // A later Show more then focuses again, even where it adds at the same place.
      setFocusAt(null);
    },
    shown: found.slice(0, limit),
    found: found.length,
    more: found.length > limit,
    showMore: () => {
      setFocusAt(limit);
      setLimit(limit + COVER_PAGE);
    },
  };
}

/** The choices' look, for `coverPicker.css`, which holds only `var()`s: set once on the picker's content. */
const CHOICE_LOOK = {
  '--cover-radius': `${RADIUS.sm}px`,
  '--cover-edge': `0 0 0 1px ${whiteRgba(0.12)}`,
  '--cover-hover-ring': `0 0 0 1px ${GOLD_GLOW.activeBorder}`,
  '--cover-chosen-ring': `0 0 0 2px ${COLORS.primary}`,
  '--cover-focus-ring': GOLD_GLOW.focusRing,
  '--cover-fade': `${DURATION.fast}ms ${EASING.snappy}`,
} as CSSProperties;

const ART: CSSProperties = {
  display: 'block',
  width: '100%',
  aspectRatio: '63 / 88',
  objectFit: 'cover',
  borderRadius: `${RADIUS.sm}px`,
  background: COLORS.neutralFill,
};

/** A card with no art: its name on the fill, in the art's place. */
const NO_ART: CSSProperties = {
  ...ART,
  boxSizing: 'border-box',
  padding: SPACING.xs,
  fontSize: `${FONT_SIZES.xs}px`,
  color: COLORS.textMuted,
  overflow: 'hidden',
};

const CHECK: CSSProperties = {
  position: 'absolute',
  top: -SPACING.xs,
  right: -SPACING.xs,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 20,
  height: 20,
  borderRadius: `${RADIUS.pill}px`,
  background: COLORS.primary,
  color: COLORS.background,
};

/** The chosen card's mark beside its gold ring, so the pick reads without colour too. */
function ChosenMark() {
  return (
    <span aria-hidden="true" style={CHECK}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
        <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

interface ChoiceProps {
  card: LorcanaCard;
  chosen: boolean;
  disabled: boolean;
  onPick: () => void;
}

/** One card to pick: its small art, named by the card's name. */
function CardChoice({card, chosen, disabled, onPick}: ChoiceProps) {
  const art = smallImageUrl(card);
  return (
    <li>
      <button type="button" className="cover-choice" aria-pressed={chosen} disabled={disabled} onClick={onPick}>
        {art === undefined ? (
          <span style={NO_ART}>{card.fullName}</span>
        ) : (
          <img src={art} alt={card.fullName} loading="lazy" decoding="async" style={ART} />
        )}
        {chosen && <ChosenMark />}
      </button>
    </li>
  );
}

/** The rarest choice's face, inside a button with no chrome but its ring (`coverPicker.css`). */
const RAREST: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: SPACING.md,
  padding: SPACING.sm,
  borderRadius: `${RADIUS.sm}px`,
  background: COLORS.surfaceAlt,
};

const RAREST_SPACE: CSSProperties = {marginTop: SPACING.lg};

const RAREST_WORDS: CSSProperties = {display: 'flex', flexDirection: 'column', gap: SPACING.xxs, minWidth: 0};

const RAREST_NAME: CSSProperties = {...TRUNCATE, fontSize: `${FONT_SIZES.sm}px`, color: COLORS.textMuted};

interface RarestProps {
  /** The card it picks now: the rarest you have, or null with none. */
  card: LorcanaCard | null;
  chosen: boolean;
  disabled: boolean;
  onPick: () => void;
}

/** "The rarest card you have": no card picked, so the cover follows the collection. */
function RarestChoice({card, chosen, disabled, onPick}: RarestProps) {
  return (
    <div style={RAREST_SPACE}>
      <button type="button" className="cover-choice" aria-pressed={chosen} disabled={disabled} onClick={onPick}>
        <span style={RAREST}>
          <BinderMedal card={card} size={40} />
          <span style={RAREST_WORDS}>
            <span style={{fontWeight: FONT_WEIGHT.semibold}}>The rarest card you have</span>
            <span style={RAREST_NAME}>{card?.fullName ?? 'None of its cards yet'}</span>
          </span>
        </span>
        {chosen && <ChosenMark />}
      </button>
    </div>
  );
}

const FIND_LABEL: CSSProperties = {...HEADING, display: 'block', margin: `${SPACING.lg}px 0 ${SPACING.xs}px`};

const GRID: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))',
  gap: SPACING.md,
  margin: `${SPACING.md}px 0 0`,
  padding: SPACING.xxs,
  listStyle: 'none',
};

const NOTE: CSSProperties = {margin: `${SPACING.md}px 0 0`, fontSize: `${FONT_SIZES.base}px`, color: COLORS.textMuted};

const PROBLEM_SPACE: CSSProperties = {marginTop: SPACING.md};

const FOOT: CSSProperties = {display: 'flex', flexDirection: 'column', gap: SPACING.sm, marginTop: SPACING.lg};

interface FindProps {
  query: string;
  onFind: (words: string) => void;
  inputRef: RefObject<HTMLInputElement | null>;
}

/** Find a card: narrows the cards on show by name, as the search box matches them. */
function FindField({query, onFind, inputRef}: FindProps) {
  const id = useId();
  return (
    <>
      <label htmlFor={id} style={FIND_LABEL}>
        Find a card
      </label>
      <input
        id={id}
        ref={inputRef}
        type="search"
        autoComplete="off"
        value={query}
        onChange={(event) => onFind(event.target.value)}
        style={FIELD}
      />
    </>
  );
}

/** What the picker says under the cards: a save on its way, or why the last one didn't land. */
function SaveLine({saving, problem}: {saving: boolean; problem: CoverProblem | null}) {
  if (saving) {
    return (
      <p role="status" style={NOTE}>
        Saving…
      </p>
    );
  }
  return <ProblemLine problem={problem} failedWords={FAILED_WORDS} style={PROBLEM_SPACE} />;
}

/** The card the cover names while the binder still holds it, else null: the cover is the rarest. */
function namedCover({binder, shelfCover}: Pick<CoverPickerProps, 'binder' | 'shelfCover'>, cards: readonly LorcanaCard[]) {
  const coverId = binder === null ? shelfCover : binder.coverId;
  return cards.some((card) => card.id === coverId) ? coverId : null;
}

interface CardsPartProps {
  choices: LorcanaCard[];
  list: ReturnType<typeof useShownCards>;
  listRef: RefObject<HTMLUListElement | null>;
  findRef: RefObject<HTMLInputElement | null>;
  /** The card picked now, or null for the rarest. */
  named: string | null;
  saving: boolean;
  onPick: (id: string) => void;
}

/** The cards to pick under Find a card, or the line that says the binder holds none of yours. */
function CardsPart({choices, list, listRef, findRef, named, saving, onPick}: CardsPartProps) {
  if (choices.length === 0) return <p style={NOTE}>You have none of its cards yet.</p>;
  return (
    <>
      <FindField query={list.query} onFind={list.find} inputRef={findRef} />
      <ul ref={listRef} aria-label="Your cards" style={GRID}>
        {list.shown.map((card) => (
          <CardChoice key={card.id} card={card} chosen={card.id === named} disabled={saving} onPick={() => onPick(card.id)} />
        ))}
      </ul>
      {list.found === 0 && <p style={NOTE}>None of your cards here match.</p>}
    </>
  );
}

/**
 * Change cover, from a cover's ⋯ on the shelf: "Cover for Amber", or for My collection. First "The
 * rarest card you have", which leaves the cover to follow the collection and shows the card it
 * picks now; then the cards the binder holds that you have, in the cover's own order, 40 at a
 * time with Show more, which Find a card narrows by name. The chosen one is ringed and marked. A
 * pick saves at once and closes the picker once it lands; a failure keeps it open and says so. A
 * dialog on a computer and a tablet, a sheet on a phone.
 *
 * Lazy, in a chunk of its own, and only with binders on (`flag.ts`). It carries `ph-no-capture`:
 * the title is the player's own words.
 */
export function CoverPicker(props: CoverPickerProps) {
  const {binder, pool, entries, isMobile} = props;
  const save = useCoverSave(props);
  const findRef = useRef<HTMLInputElement>(null);
  const cards = cardsOf(pool, binder);
  const choices = coverChoices(cards, entries);
  const listRef = useRef<HTMLUListElement>(null);
  const list = useShownCards(choices, listRef);
  const named = namedCover(props, cards);
  // On a phone focus starts on the sheet, so the keyboard waits for a press on Find a card.
  const focusFind = !isMobile && choices.length > 0;
  // Against the cover saved, not the one shown, so the rarest also clears a card the rules left.
  const saved = binder === null ? props.shelfCover : binder.coverId;
  const pick = (id: string | null) => {
    if (id === saved) props.onSaved();
    else void save.pick(id);
  };
  const close = () => {
    if (!save.saving) props.onClose();
  };
  return (
    <AskDialog
      isOpen={props.isOpen}
      isMobile={isMobile}
      onClose={close}
      dialogName={DIALOG_NAME}
      size="md"
      initialFocusRef={focusFind ? findRef : undefined}>
      <div className="ph-no-capture" style={CHOICE_LOOK}>
        <WhenGone onGone={props.onGone} />
        <h2 style={DIALOG_TITLE}>Cover for {binder?.name ?? MY_COLLECTION}</h2>
        <p style={LEAD}>Pick the card its cover shows.</p>
        <RarestChoice card={choices[0] ?? null} chosen={named === null} disabled={save.saving} onPick={() => pick(null)} />
        <CardsPart
          choices={choices}
          list={list}
          listRef={listRef}
          findRef={findRef}
          named={named}
          saving={save.saving}
          onPick={pick}
        />
        <SaveLine saving={save.saving} problem={save.problem} />
        <div style={FOOT}>
          {list.more && (
            <CtaButton variant="ghost" onClick={list.showMore} disabled={save.saving}>
              Show more
            </CtaButton>
          )}
          <CtaButton variant="neutral" onClick={close} disabled={save.saving}>
            Cancel
          </CtaButton>
        </div>
      </div>
    </AskDialog>
  );
}
