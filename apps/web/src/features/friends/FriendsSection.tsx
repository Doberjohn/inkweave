import {useEffect, useId, useRef, useState} from 'react';
import {flushSync} from 'react-dom';
import Skeleton from 'react-loading-skeleton';
import {CtaButton, IconButton} from '../../shared/components';
import type {CtaVariant} from '../../shared/components/CtaButton';
import {
  CAP_LABEL_XS,
  COLORS,
  FONTS,
  FONT_SIZES,
  ICON_SIZE,
  LETTER_SPACING,
  RADIUS,
  SPACING,
  TABULAR,
  TOUCH_TARGET,
  hexRgba,
  searchFieldStyle,
} from '../../shared/constants';
import {useHover} from '../../shared/hooks';
import {trackEvent} from '../../shared/lib/analytics';
import {formatFriendCode, normalizeFriendCode} from './friendCode';
import {CheckIcon, CopyIcon} from './icons';
import type {FriendRow, FriendsStatus, SendOutcome} from './useFriends';

/**
 * The Friends section's contents on /account (#852): the player's code, a field for a
 * friend's, and the requests, sent requests and friends, each a list under its own h3. The
 * page's `Section` frames it and gives it its h2 (`pages/AccountFriends.tsx`).
 *
 * Presentational: `useFriends` owns the data and every call, and reloads after each action,
 * so a row leaves only when the database says it has. While an action runs (`busy`), every
 * button looks off and does nothing, through `aria-disabled` rather than `disabled`, which
 * would drop the focus the clicked button holds.
 */
export interface FriendsSectionProps {
  status: FriendsStatus;
  /** The player's code as stored, ABCD2345. */
  code: string | null;
  received: FriendRow[];
  sent: FriendRow[];
  friends: FriendRow[];
  busy: boolean;
  onRetry: () => void;
  onSend: (code: string) => Promise<SendOutcome>;
  /** Each resolves to the words to show when it failed, or null. */
  onAccept: (row: FriendRow) => Promise<string | null>;
  /** Declining, cancelling and removing a friend are all this. */
  onRemove: (row: FriendRow) => Promise<string | null>;
}

const MUTED: React.CSSProperties = {color: COLORS.textMuted, fontSize: `${FONT_SIZES.md}px`, margin: 0};
const LABEL: React.CSSProperties = {color: COLORS.textMuted, fontSize: `${FONT_SIZES.sm}px`, minWidth: '12ch'};
/** The rule between rows, and above the lists, as the reveals sections draw theirs. */
const RULE = `1px solid ${hexRgba(COLORS.surfaceBorder, 0.6)}`;
const DETAIL: React.CSSProperties = {color: COLORS.textMuted, fontSize: `${FONT_SIZES.sm}px`};
const ANSWER: React.CSSProperties = {fontSize: `${FONT_SIZES.md}px`, margin: `${SPACING.xs}px 0 0`};
/** The code and its copy button, then the line under them. */
const CODE_COLUMN: React.CSSProperties = {display: 'flex', flexDirection: 'column'};
const CODE_LINE: React.CSSProperties = {display: 'inline-flex', alignItems: 'center', gap: SPACING.xxs, flexWrap: 'wrap', minWidth: 0};
const SEND_FORM: React.CSSProperties = {display: 'flex', alignItems: 'center', gap: SPACING.sm, flexWrap: 'wrap', flex: '1 1 auto', margin: 0};
const CODE_FIELD_SIZE: React.CSSProperties = {flex: '1 1 160px', minWidth: 0, maxWidth: 240};
/**
 * The code field's own width, its default 20 characters at FONT_SIZES.lg with its padding, and
 * Send's: together they decide whether the form fits beside its label or drops below it, as it
 * does on a phone.
 */
const CODE_FIELD_NATURAL_WIDTH = 203;
const SEND_WIDTH = 124;
const LIST_HEADING: React.CSSProperties = {...CAP_LABEL_XS, margin: `${SPACING.xl}px 0 ${SPACING.xs}px`};
const EMPTY_LINE: React.CSSProperties = {...MUTED, marginTop: SPACING.xs};

/** How long the check and "Copied" stay after a copy. */
const COPIED_MS = 2000;

export function FriendsSection(props: FriendsSectionProps) {
  if (props.status === 'loading') return <FriendsLoading />;
  if (props.status === 'failed') return <LoadFailed onRetry={props.onRetry} />;
  return <FriendsReady {...props} />;
}

function LoadFailed({onRetry}: {onRetry: () => void}) {
  return (
    <>
      <p role="alert" style={MUTED}>
        Couldn&apos;t load your friends.
      </p>
      <CtaButton variant="neutral" onClick={onRetry} style={{marginTop: SPACING.lg}}>
        Try again
      </CtaButton>
    </>
  );
}

/** One placeholder exactly its box: no line box around it (`inline`, then drawn as a block). */
function Block({width, height}: {width?: number | string; height: number}) {
  return <Skeleton inline width={width} height={height} borderRadius={RADIUS.sm} style={{display: 'block'}} />;
}

/** A line of text at `size`, its bar centered in the line's box (the body's 1.5 line height). */
function TextLine({size, width}: {size: number; width: number | string}) {
  return (
    <div style={{height: size * 1.5, display: 'flex', flexDirection: 'column', justifyContent: 'center'}}>
      <Block width={width} height={size} />
    </div>
  );
}

/**
 * The section while the friendships load (#914), in the boxes of a loaded section with no
 * one in it, which every player's has: the code row, the field and its button, the rule, and
 * Your friends with its one line. Requests and Sent show only when they have rows. The labels
 * are the loaded ones; what the read brings is a placeholder.
 */
function FriendsLoading() {
  return (
    <div role="group" aria-busy="true" aria-label="Loading your friends">
      <Field label={<span style={LABEL}>Your friend code</span>}>
        <span style={CODE_COLUMN}>
          <span style={{...CODE_LINE, height: TOUCH_TARGET}}>
            <Block width={96} height={FONT_SIZES.xl} />
            {/* The copy button's icon, in its touch target. */}
            <span style={{width: TOUCH_TARGET, display: 'flex', justifyContent: 'center'}}>
              <Block width={ICON_SIZE.md} height={ICON_SIZE.md} />
            </span>
          </span>
          <TextLine size={FONT_SIZES.xs} width={260} />
        </span>
      </Field>
      <Field label={<span style={LABEL}>Add a friend</span>}>
        <div style={SEND_FORM}>
          <div style={{...CODE_FIELD_SIZE, width: CODE_FIELD_NATURAL_WIDTH}}>
            <Block height={TOUCH_TARGET} />
          </div>
          <Block width={SEND_WIDTH} height={TOUCH_TARGET} />
        </div>
      </Field>
      <div style={{borderTop: RULE, marginTop: SPACING.md}} />
      <h3 style={LIST_HEADING}>Your friends</h3>
      <div style={{marginTop: SPACING.xs}}>
        <TextLine size={FONT_SIZES.md} width="60%" />
      </div>
    </div>
  );
}

/** A labelled line, laid out as the page's Identity rows are. */
function Field({label, children}: {label: React.ReactNode; children: React.ReactNode}) {
  return (
    <div style={{display: 'flex', alignItems: 'center', gap: SPACING.md, flexWrap: 'wrap', padding: `${SPACING.sm}px 0`}}>
      {label}
      {children}
    </div>
  );
}

type ListName = 'received' | 'sent' | 'friends';

/** A row's action as `friend_action` names it. */
type FriendAction = 'accept' | 'decline' | 'cancel' | 'remove';

/** What removing a row means, by the list it leaves. */
const REMOVAL: Record<ListName, FriendAction> = {received: 'decline', sent: 'cancel', friends: 'remove'};

/** The row an action may take away: which list, where in it, and whose. */
interface Leaving {
  list: ListName;
  index: number;
  id: string;
}

function FriendsReady({code, received, sent, friends, busy, onSend, onAccept, onRemove}: FriendsSectionProps) {
  const [failure, setFailure] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const {watch, listRefs, headingRefs} = useFocusAfterLeaving({received, sent, friends});

  const act = async (leaving: Leaving, kind: FriendAction, action: () => Promise<string | null>) => {
    watch(leaving);
    setFailure(null);
    const error = await action();
    trackEvent('friend_action', {action: kind, ok: error === null});
    setFailure(error);
    if (error === null) setConfirming(null);
  };

  // The question opens and closes in place, and focus goes to the button now where the
  // pressed one was, which the render has to have drawn first.
  const ask = (id: string | null, focusId: string) => {
    flushSync(() => setConfirming(id));
    document.getElementById(focusId)?.focus();
  };

  const rowActions: RowActions = {
    busy,
    confirming,
    ask,
    accept: (leaving, row) => void act(leaving, 'accept', () => onAccept(row)),
    remove: (leaving, row) => void act(leaving, REMOVAL[leaving.list], () => onRemove(row)),
  };

  return (
    <>
      {code && <CodeRow code={code} />}
      <AddFriend busy={busy} onSend={onSend} />
      <div style={{borderTop: RULE, marginTop: SPACING.md}} />
      <Requests rows={received} listRef={listRefs.received} headingRef={headingRefs.received} actions={rowActions} />
      <Sent rows={sent} listRef={listRefs.sent} headingRef={headingRefs.sent} actions={rowActions} />
      <Friends rows={friends} listRef={listRefs.friends} headingRef={headingRefs.friends} actions={rowActions} />
      {failure && (
        <p role="alert" style={{...ANSWER, color: COLORS.error}}>
          {failure}
        </p>
      )}
    </>
  );
}

/** The lists in reading order. */
const LISTS: ListName[] = ['received', 'sent', 'friends'];

type ListRefs<T> = Record<ListName, React.RefObject<T | null>>;

/**
 * Where focus goes once the row that held it has left: the row now in its place (the one
 * above, when it was the last), else the heading of the next list still on screen (Sent,
 * after Requests empties), else Your friends, which always shows. Requests and Sent
 * disappear when empty, so their own headings are gone by then.
 */
function focusTarget(
  leaving: Leaving,
  lists: ListRefs<HTMLUListElement>,
  headings: ListRefs<HTMLHeadingElement>,
): HTMLElement | null {
  const items = lists[leaving.list].current?.children;
  const row = items?.[Math.min(leaving.index, items.length - 1)]?.querySelector('button');
  if (row) return row;
  const later = LISTS.slice(LISTS.indexOf(leaving.list) + 1).map((name) => headings[name].current);
  return later.find((heading) => heading !== null) ?? headings.friends.current;
}

/**
 * Moves focus when an action takes away the row that held it (`focusTarget`). It runs after
 * every render because the lists without the row come from the page's reload, which can land
 * after the action's own renders.
 */
function useFocusAfterLeaving(rows: Record<ListName, FriendRow[]>) {
  const leavingRef = useRef<Leaving | null>(null);
  // Each ref its own statement: inside an object literal, the React Compiler caches the
  // literal and skips the useRef calls on the next render.
  const receivedListRef = useRef<HTMLUListElement>(null);
  const sentListRef = useRef<HTMLUListElement>(null);
  const friendsListRef = useRef<HTMLUListElement>(null);
  const receivedHeadingRef = useRef<HTMLHeadingElement>(null);
  const sentHeadingRef = useRef<HTMLHeadingElement>(null);
  const friendsHeadingRef = useRef<HTMLHeadingElement>(null);
  const listRefs: ListRefs<HTMLUListElement> = {received: receivedListRef, sent: sentListRef, friends: friendsListRef};
  const headingRefs: ListRefs<HTMLHeadingElement> = {
    received: receivedHeadingRef,
    sent: sentHeadingRef,
    friends: friendsHeadingRef,
  };

  useEffect(() => {
    const leaving = leavingRef.current;
    if (!leaving || rows[leaving.list].some((row) => row.id === leaving.id)) return;
    leavingRef.current = null;
    // Only when the row took the focus with it: a player who moved on keeps their place.
    if (document.activeElement !== document.body) return;
    focusTarget(leaving, listRefs, headingRefs)?.focus();
  });

  /** Notes the row an action may take away, so focus can follow if it goes. */
  const watch = (leaving: Leaving) => {
    leavingRef.current = leaving;
  };
  return {watch, listRefs, headingRefs};
}

/**
 * The player's code and its copy button. The clipboard can refuse, which in-app browsers do
 * even on HTTPS, so one click on the code also selects all of it (`user-select: all`).
 */
function CodeRow({code}: {code: string}) {
  // A new object for each copy, so a second copy restarts the two seconds.
  const [note, setNote] = useState<{copied: boolean} | null>(null);

  // The check and "Copied" leave on their own. A refusal stays: it asks the player to act.
  useEffect(() => {
    if (!note?.copied) return;
    const timer = setTimeout(() => setNote(null), COPIED_MS);
    return () => clearTimeout(timer);
  }, [note]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(formatFriendCode(code));
      trackEvent('friend_code_copied', {result: 'copied'});
      setNote({copied: true});
    } catch {
      // In-app browsers refuse the clipboard even on HTTPS.
      trackEvent('friend_code_copied', {result: 'blocked'});
      setNote({copied: false});
    }
  };

  const copied = note?.copied === true;
  return (
    <Field label={<span style={LABEL}>Your friend code</span>}>
      <span style={CODE_COLUMN}>
        <span style={CODE_LINE}>
          <span
            className="ph-no-capture"
            style={{
              ...TABULAR,
              color: COLORS.text,
              fontSize: `${FONT_SIZES.xl}px`,
              fontWeight: 600,
              letterSpacing: LETTER_SPACING.eyebrow,
              userSelect: 'all',
            }}>
            {formatFriendCode(code)}
          </span>
          <IconButton
            aria-label="Copy your friend code"
            onClick={() => void copy()}
            style={copied ? {color: COLORS.success} : undefined}>
            {copied ? <CheckIcon /> : <CopyIcon />}
          </IconButton>
          <span aria-live="polite" style={{...DETAIL, color: copied ? COLORS.success : COLORS.textMuted}}>
            {note && (copied ? 'Copied' : "Couldn't copy. Select the code instead.")}
          </span>
        </span>
        <span style={{...DETAIL, fontSize: `${FONT_SIZES.xs}px`}}>
          Give it to someone so they can send you a friend request.
        </span>
      </span>
    </Field>
  );
}

/** The field for a friend's code. Send stays off until it holds a whole one. */
function AddFriend({busy, onSend}: Pick<FriendsSectionProps, 'busy' | 'onSend'>) {
  const id = useId();
  const fieldRef = useRef<HTMLInputElement>(null);
  const [typed, setTyped] = useState('');
  const [answer, setAnswer] = useState<Answer | null>(null);
  const code = normalizeFriendCode(typed);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (code === null || busy) return;
    const sentText = typed;
    const outcome = await onSend(code);
    setAnswer((last) => numbered(outcome, last));
    if (!outcome.ok) return;
    // Emptied only if it still holds what was sent: a code typed while the send was on its
    // way stays there for the next one.
    setTyped((now) => (now === sentText ? '' : now));
    // Send turns off once the field is empty, so the next code starts where it is typed.
    fieldRef.current?.focus();
  };

  return (
    <>
      <Field
        label={
          <label htmlFor={id} style={LABEL}>
            Add a friend
          </label>
        }>
        <form
          noValidate
          onSubmit={(event) => void submit(event)}
          style={SEND_FORM}>
          <CodeField id={id} ref={fieldRef} value={typed} onChange={setTyped} />
          <CtaButton type="submit" disabled={code === null} aria-disabled={busy || undefined}>
            Send request
          </CtaButton>
        </form>
      </Field>
      <SendAnswer answer={answer} />
    </>
  );
}

function CodeField({
  id,
  ref,
  value,
  onChange,
}: {
  id: string;
  ref: React.Ref<HTMLInputElement>;
  value: string;
  onChange: (value: string) => void;
}) {
  const [focused, setFocused] = useState(false);
  const {hovered, hoverProps} = useHover();
  return (
    <input
      ref={ref}
      id={id}
      // Someone else's code: kept out of PostHog, as the player's own is.
      className="ph-no-capture"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      {...hoverProps}
      placeholder="Friend code"
      autoComplete="off"
      autoCapitalize="characters"
      spellCheck={false}
      style={{
        // The app's search-field surface: raised, a lighter edge on hover, gold with the
        // focus ring while focused.
        ...searchFieldStyle({focused, hovered}),
        ...CODE_FIELD_SIZE,
        height: TOUCH_TARGET,
        boxSizing: 'border-box',
        padding: `0 ${SPACING.md}px`,
        borderRadius: `${RADIUS.lg}px`,
        color: COLORS.text,
        fontFamily: FONTS.body,
        fontSize: `${FONT_SIZES.lg}px`,
        outline: 'none',
      }}
    />
  );
}

/** A send's outcome, numbered so each refusal mounts an alert of its own. */
type Answer = SendOutcome & {seq: number};

const numbered = (outcome: SendOutcome, last: Answer | null): Answer => ({...outcome, seq: (last?.seq ?? 0) + 1});

/**
 * What the last send turned into. The status line stays mounted, empty, so a screen reader
 * is already listening when it changes; a refusal comes as an alert, a new one each time, so
 * a second refusal with the same words is spoken too. Both can name someone.
 */
function SendAnswer({answer}: {answer: Answer | null}) {
  const sent = answer?.ok === true;
  return (
    <>
      <p role="status" className="ph-no-capture" style={{...ANSWER, color: COLORS.success, ...(sent ? {} : {margin: 0})}}>
        {sent && answer.message}
      </p>
      {answer && !answer.ok && (
        <p key={answer.seq} role="alert" className="ph-no-capture" style={{...ANSWER, color: COLORS.error}}>
          {answer.message}
        </p>
      )}
    </>
  );
}

/** What every row's buttons share: the busy flag, the open Remove question, and the actions. */
interface RowActions {
  busy: boolean;
  /** The friend whose Remove asks first right now. */
  confirming: string | null;
  ask: (id: string | null, focusId: string) => void;
  accept: (leaving: Leaving, row: FriendRow) => void;
  remove: (leaving: Leaving, row: FriendRow) => void;
}

interface ListProps {
  rows: FriendRow[];
  listRef: React.Ref<HTMLUListElement>;
  /** Takes the focus when a list above it empties (`focusTarget`). */
  headingRef: React.Ref<HTMLHeadingElement>;
  actions: RowActions;
}

function Requests({rows, listRef, headingRef, actions}: ListProps) {
  if (rows.length === 0) return null;
  return (
    <PeopleList
      heading={`Requests (${rows.length})`}
      headingRef={headingRef}
      rows={rows}
      listRef={listRef}
      joiner="request from"
      buttons={(row, index, labelledBy) => {
        const leaving: Leaving = {list: 'received', index, id: row.id};
        return (
          <>
            <RowButton
              word="Accept"
              variant="ghost"
              labelledBy={labelledBy}
              busy={actions.busy}
              onClick={() => actions.accept(leaving, row)}
            />
            <RowButton
              word="Decline"
              variant="neutral"
              labelledBy={labelledBy}
              busy={actions.busy}
              onClick={() => actions.remove(leaving, row)}
            />
          </>
        );
      }}
    />
  );
}

function Sent({rows, listRef, headingRef, actions}: ListProps) {
  if (rows.length === 0) return null;
  return (
    <PeopleList
      heading={`Sent (${rows.length})`}
      headingRef={headingRef}
      rows={rows}
      listRef={listRef}
      joiner="request to"
      meta={() => 'Waiting'}
      buttons={(row, index, labelledBy) => (
        <RowButton
          word="Cancel"
          variant="neutral"
          labelledBy={labelledBy}
          busy={actions.busy}
          onClick={() => actions.remove({list: 'sent', index, id: row.id}, row)}
        />
      )}
    />
  );
}

/** "Friends since" as the Collection's "Last changed" shows a day: 20 Oct 2026, in the viewer's locale. */
function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {day: 'numeric', month: 'short', year: 'numeric'});
}

function Friends({rows, listRef, headingRef, actions}: ListProps) {
  return (
    <PeopleList
      heading={rows.length > 0 ? `Your friends (${rows.length})` : 'Your friends'}
      headingRef={headingRef}
      rows={rows}
      listRef={listRef}
      empty="No friends yet. Share your code, or enter a friend's."
      meta={(row) => (row.since ? `Friends since ${formatDay(row.since)}` : null)}
      buttons={(row, index, labelledBy) => (
        <RemoveControls
          labelledBy={labelledBy}
          busy={actions.busy}
          confirming={actions.confirming === row.id}
          onAsk={(open, focusId) => actions.ask(open ? row.id : null, focusId)}
          onRemove={() => actions.remove({list: 'friends', index, id: row.id}, row)}
        />
      )}
    />
  );
}

/** Remove asks first, in place, as the Collection section's Clear does. */
function RemoveControls({
  labelledBy,
  busy,
  confirming,
  onAsk,
  onRemove,
}: {
  labelledBy: string;
  busy: boolean;
  confirming: boolean;
  onAsk: (open: boolean, focusId: string) => void;
  onRemove: () => void;
}) {
  const askId = useId();
  const yesId = useId();
  if (!confirming) {
    return (
      <RowButton
        id={askId}
        word="Remove"
        variant="neutral"
        labelledBy={labelledBy}
        busy={busy}
        onClick={() => onAsk(true, yesId)}
      />
    );
  }
  return (
    <>
      <RowButton id={yesId} word="Remove friend" variant="neutral" labelledBy={labelledBy} busy={busy} onClick={onRemove} />
      <CtaButton
        variant="ghost"
        aria-disabled={busy || undefined}
        onClick={busy ? undefined : () => onAsk(false, askId)}>
        Cancel
      </CtaButton>
    </>
  );
}

interface PeopleListProps {
  heading: string;
  headingRef?: React.Ref<HTMLHeadingElement>;
  rows: FriendRow[];
  listRef: React.Ref<HTMLUListElement>;
  /** Shown instead of the list when it has no rows. */
  empty?: string;
  /** Words between a button's own and the person's name, in the button's accessible name. */
  joiner?: string;
  meta?: (row: FriendRow) => string | null;
  buttons: (row: FriendRow, index: number, labelledBy: string) => React.ReactNode;
}

function PeopleList({heading, headingRef, rows, listRef, empty, joiner, meta, buttons}: PeopleListProps) {
  const joinerId = useId();
  return (
    <>
      {/* Focusable from script only: it takes the focus when a list empties under it. */}
      <h3 ref={headingRef} tabIndex={-1} style={LIST_HEADING}>
        {heading}
      </h3>
      {joiner && (
        <span id={joinerId} hidden>
          {joiner}
        </span>
      )}
      {rows.length === 0 && empty ? (
        <p style={EMPTY_LINE}>{empty}</p>
      ) : (
        <ul ref={listRef} style={{listStyle: 'none', margin: 0, padding: 0}}>
          {rows.map((row, index) => (
            <Person
              key={row.id}
              row={row}
              first={index === 0}
              meta={meta?.(row) ?? null}
              buttons={(nameId) => buttons(row, index, joiner ? `${joinerId} ${nameId}` : nameId)}
            />
          ))}
        </ul>
      )}
    </>
  );
}

function Person({
  row,
  first,
  meta,
  buttons,
}: {
  row: FriendRow;
  first: boolean;
  meta: string | null;
  buttons: (nameId: string) => React.ReactNode;
}) {
  const nameId = useId();
  return (
    <li
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: SPACING.md,
        flexWrap: 'wrap',
        padding: `${SPACING.sm}px 0`,
        borderTop: first ? 'none' : RULE,
      }}>
      {/* Names are public, but who is whose friend is not: kept out of PostHog (#827). */}
      <span style={{display: 'flex', alignItems: 'baseline', gap: SPACING.sm, flexWrap: 'wrap', minWidth: 0}}>
        <span id={nameId} className="ph-no-capture" style={{color: COLORS.text, fontSize: `${FONT_SIZES.md}px`, fontWeight: 600}}>
          {row.name}
        </span>
        {row.handle && (
          <span className="ph-no-capture" style={DETAIL}>
            @{row.handle}
          </span>
        )}
        {meta && <span style={DETAIL}>{meta}</span>}
      </span>
      <span style={{marginLeft: 'auto', display: 'flex', gap: SPACING.sm}}>{buttons(nameId)}</span>
    </li>
  );
}

/**
 * A row's button. Its accessible name is its own word, the list's joining words, then the
 * person ("Accept request from Ruby Hero 042"), assembled with `aria-labelledby` from text
 * already on the page. An `aria-label` would put the friend's name in every click PostHog's
 * autocapture records, which copies the clicked button's attributes; these ids say nothing.
 */
function RowButton({
  id: givenId,
  word,
  variant,
  labelledBy,
  busy,
  onClick,
}: {
  id?: string;
  word: string;
  variant: CtaVariant;
  labelledBy: string;
  busy: boolean;
  onClick: () => void;
}) {
  const ownId = useId();
  const id = givenId ?? ownId;
  return (
    <CtaButton
      id={id}
      variant={variant}
      aria-labelledby={`${id} ${labelledBy}`}
      aria-disabled={busy || undefined}
      onClick={busy ? undefined : onClick}>
      {word}
    </CtaButton>
  );
}
