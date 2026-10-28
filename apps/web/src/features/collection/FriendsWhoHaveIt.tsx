import {useEffect, useRef, type CSSProperties, type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {Link} from 'react-router-dom';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {isModifiedClick} from 'inkweave-ui/utils/touchGuard';
import {BottomSheet, DialogShell, IconButton} from '../../shared/components';
import {
  binderSetOf,
  CAP_LABEL,
  COLORS,
  DIALOG_TITLE,
  EASING,
  FONTS,
  FONT_SIZES,
  LETTER_SPACING,
  RADIUS,
  SPACING,
  VISUALLY_HIDDEN,
} from '../../shared/constants';
import {printedCardNumber, useDialogFocus, useHover, useScrollLock, useTransitionPresence} from '../../shared/hooks';
import {smallImageUrl} from '../cards/loader';
import {FriendChip} from '../friends/FriendChip';
import {friendBinderPath} from '../friends/friendBinderPath';
import {ChevronIcon} from '../friends/icons';
import type {CollectionEntry, Finish} from './collectionParser';
import {FinishCount} from './FinishCount';
import {friendsHaveLine, friendsWord, type FriendHas, type FriendsFor} from './friendsHave';

/** Router state a row hands the friend's binder: the card to open on, never in the address. */
export interface AtCard {
  atCard: string;
}

interface FriendsWhoHaveItProps {
  isOpen: boolean;
  onClose: () => void;
  /** The printing the card window shows. */
  card: LorcanaCard;
  /** The name printed on it (`printedFullName`'s parts): a promo can carry another. */
  printedName?: string;
  /** The finishes it comes in (`finishesOf`). */
  finishes: readonly Finish[];
  /** What the reader holds of it. */
  held: CollectionEntry;
  have: FriendsFor;
  /** How many of the reader's friends don't share their collection. */
  notSharing: number;
  isMobile: boolean;
  /** A row was followed: the friend's binder opens behind the card window, which closes too. */
  onFollow: () => void;
}

const DIALOG_NAME = 'Friends who have it';

/** What the reader holds of the card: "You're missing it", or "You have 1 normal · missing the foil". */
function heldLine(held: CollectionEntry, lacked: readonly Finish[]): string {
  const have = (['normal', 'foil'] as const).filter((finish) => held[finish] > 0);
  if (have.length === 0) return "You're missing it";
  const parts = have.map((finish) => `${held[finish]} ${finish}`).join(' and ');
  return `You have ${parts} · missing the ${lacked.join(' and the ')}`;
}

/** "3 friends don't share their collection, so they aren't counted." */
const notSharingLine = (count: number) =>
  `${friendsWord(count)} ${count === 1 ? "doesn't" : "don't"} share their collection, so they aren't counted.`;

/**
 * Escape closes this alone over the card window. The window listens on the document too, and
 * opened first, so its listener would run first and close it as well: a listener on the window,
 * in the capture phase, runs before both and keeps the key.
 */
function useEscapeFirst(isOpen: boolean, onClose: () => void) {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [isOpen, onClose]);
}

/**
 * Friends who have it: the card on show, what the reader holds of it, and a row per sharing
 * friend holding a copy in a finish the reader lacks, with their copies in each, most first.
 * Each row opens that friend's binder at the card. A dialog on a computer, a sheet on a phone,
 * stacked over the card window, whose Escape it keeps (`useEscapeFirst`).
 */
export function FriendsWhoHaveIt({isOpen, onClose, isMobile, ...body}: FriendsWhoHaveItProps) {
  useEscapeFirst(isOpen, onClose);
  if (isMobile) {
    return (
      <PhoneSheet isOpen={isOpen} onClose={onClose}>
        <WhoHasIt {...body} gutter={SPACING.lg} />
      </PhoneSheet>
    );
  }
  return (
    <DialogShell isOpen={isOpen} onClose={onClose} ariaLabel={DIALOG_NAME} size="md" layer="lightbox" panelStyle={PANEL_STYLE}>
      <h2 style={{...DIALOG_TITLE, padding: `${SPACING.xxl}px ${SPACING.xxl}px 0`}}>{DIALOG_NAME}</h2>
      <WhoHasIt {...body} gutter={SPACING.xxl} />
    </DialogShell>
  );
}

/** A column, so the list scrolls under the title and the card while they stay. */
const PANEL_STYLE: CSSProperties = {display: 'flex', flexDirection: 'column', overflow: 'hidden'};

type BodyProps = Omit<FriendsWhoHaveItProps, 'isOpen' | 'onClose' | 'isMobile'> & {
  /** The space at the sides and the foot: the dialog's, or the narrower sheet's. */
  gutter: number;
};

function WhoHasIt({card, printedName, finishes, held, have, notSharing, onFollow, gutter}: BodyProps) {
  const {lacked, friends} = have;
  return (
    <div style={{...BODY_STYLE, padding: `${SPACING.lg}px ${gutter}px ${gutter}px`}}>
      <CardLine card={card} printedName={printedName} line={heldLine(held, lacked)} />
      <div style={{...GRID, padding: `0 ${SPACING.sm}px`}}>
        <h3 style={HEADING_STYLE}>{friendsHaveLine(friends.length, lacked, finishes)}</h3>
        <span aria-hidden style={COUNTS_STYLE}>
          {lacked.map((finish) => (
            <span key={finish} style={COLUMN_LABEL_STYLE}>
              {finish}
            </span>
          ))}
        </span>
      </div>
      <ul className="ph-no-capture" style={LIST_STYLE}>
        {friends.map((row) => (
          <FriendRow key={row.friend.id} row={row} lacked={lacked} card={card} onFollow={onFollow} />
        ))}
      </ul>
      {notSharing > 0 && <p style={NOTE_STYLE}>{notSharingLine(notSharing)}</p>}
    </div>
  );
}

const BODY_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: SPACING.lg,
  minHeight: 0,
  flex: '1 1 auto',
};

/** The chip, the name, the counts and the arrow, the header row's labels over the counts. */
const GRID: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '28px minmax(0, 1fr) auto 16px',
  columnGap: SPACING.md,
  alignItems: 'center',
};

const HEADING_STYLE: CSSProperties = {
  gridColumn: '1 / 3',
  margin: 0,
  fontFamily: FONTS.body,
  fontSize: `${FONT_SIZES.xl}px`,
  fontWeight: 600,
  color: COLORS.text,
};

const COUNTS_STYLE: CSSProperties = {display: 'flex', gap: SPACING.sm};

const COLUMN_LABEL_STYLE: CSSProperties = {
  ...CAP_LABEL,
  minWidth: 40,
  textAlign: 'center',
  fontSize: `${FONT_SIZES.sm}px`,
  fontWeight: 600,
  letterSpacing: LETTER_SPACING.eyebrow,
};

/**
 * Ten and a half rows show, then the list scrolls: a row is 28px chip + 2 × 12px padding + 1px rule,
 * and the half row cut at the foot is what tells the reader there are more.
 */
const LIST_STYLE: CSSProperties = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  maxHeight: 10.5 * 53,
  // Shorter still where the panel or the sheet runs out of height first.
  flex: '0 1 auto',
  minHeight: 0,
  overflowY: 'auto',
  borderTop: `1px solid ${COLORS.surfaceBorder}`,
};

const NOTE_STYLE: CSSProperties = {margin: 0, fontSize: `${FONT_SIZES.base}px`, color: COLORS.textMuted};

/** The card on show, small, with its name, number and rarity, and what the reader holds of it. */
function CardLine({card, printedName, line}: {card: LorcanaCard; printedName?: string; line: string}) {
  const art = smallImageUrl(card);
  const number = printedCardNumber(card);
  return (
    <div style={CARD_LINE_STYLE}>
      {art ? <img src={art} alt="" width={56} height={78} style={ART_STYLE} /> : <span style={ART_STYLE} />}
      <div style={{display: 'flex', flexDirection: 'column', gap: SPACING.xxs, minWidth: 0}}>
        <span style={CARD_NAME_STYLE}>{printedName ?? card.name}</span>
        {printedName === undefined && card.version && <span style={VERSION_STYLE}>{card.version}</span>}
        <span style={DETAIL_STYLE}>{[number, card.rarity].filter(Boolean).join(' · ')}</span>
        <span style={{...VERSION_STYLE, color: COLORS.text}}>{line}</span>
      </div>
    </div>
  );
}

const CARD_LINE_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: SPACING.lg,
  padding: SPACING.md,
  background: COLORS.surfaceRaised,
  border: `1px solid ${COLORS.surfaceBorder}`,
  borderRadius: RADIUS.card,
  flexShrink: 0,
};

const ART_STYLE: CSSProperties = {
  display: 'block',
  width: 56,
  height: 78,
  flexShrink: 0,
  borderRadius: RADIUS.sm,
  background: COLORS.background,
};

const CARD_NAME_STYLE: CSSProperties = {fontSize: `${FONT_SIZES.xl}px`, fontWeight: 600, color: COLORS.text};
const VERSION_STYLE: CSSProperties = {fontSize: `${FONT_SIZES.lg}px`, color: COLORS.textMuted};
const DETAIL_STYLE: CSSProperties = {fontSize: `${FONT_SIZES.base}px`, color: COLORS.textMuted};

/** What a row says, for the link's name: "4 normal, 1 foil". */
const copiesWords = (row: FriendHas, lacked: readonly Finish[]) =>
  lacked.map((finish) => `${row[finish]} ${finish}`).join(', ');

interface FriendRowProps {
  row: FriendHas;
  lacked: readonly Finish[];
  card: LorcanaCard;
  onFollow: () => void;
}

/**
 * A friend, their copies in each finish the reader lacks, and a way to their binder at the card,
 * named "Ruby Hero 042: 4 normal, 1 foil. Open their binder" by a visually hidden line alone: the
 * parts on show are hidden from screen readers, as the grid's cells are blocks, so a name built
 * from them would gain a space before its colon. No name sits in an attribute PostHog's
 * autocapture reads, and the list is out of its capture too (#827). A friend with no public name
 * has no binder address, so their row links nowhere.
 */
function FriendRow({row, lacked, card, onFollow}: FriendRowProps) {
  const {hovered, hoverProps} = useHover();
  const {friend} = row;
  const words = `${friend.name}: ${copiesWords(row, lacked)}.`;
  const content = (
    <>
      <span style={VISUALLY_HIDDEN}>{friend.handle === null ? words : `${words} Open their binder`}</span>
      <FriendChip name={friend.name} handle={friend.handle} />
      <span aria-hidden style={ROW_NAME_STYLE}>
        {friend.name}
      </span>
      <span aria-hidden style={COUNTS_STYLE}>
        {lacked.map((finish) => (
          <FinishCount key={finish} finish={finish} count={row[finish]} />
        ))}
      </span>
      <span style={{display: 'flex', color: hovered ? COLORS.primary : COLORS.textMuted}}>
        {friend.handle !== null && <ChevronIcon />}
      </span>
    </>
  );
  return (
    <li style={{borderBottom: `1px solid ${COLORS.surfaceBorder}`}}>
      {friend.handle === null ? (
        <div style={{...GRID, ...ROW_STYLE}}>{content}</div>
      ) : (
        <Link
          // The binder an edition's card is collected in: CC1's is Curator's Collection's, CC.
          to={friendBinderPath(friend.handle, card.setCode && binderSetOf(card.setCode))}
          state={{atCard: card.id} satisfies AtCard}
          // A click that opens the binder in a new tab or window leaves this one as it was.
          onClick={(e) => {
            if (!isModifiedClick(e)) onFollow();
          }}
          {...hoverProps}
          style={{...GRID, ...ROW_STYLE, ...(hovered && {background: COLORS.surfaceHover})}}>
          {content}
        </Link>
      )}
    </li>
  );
}

const ROW_STYLE: CSSProperties = {
  position: 'relative',
  padding: `${SPACING.md}px ${SPACING.sm}px`,
  color: COLORS.text,
  textDecoration: 'none',
  borderRadius: RADIUS.sm,
};

const ROW_NAME_STYLE: CSSProperties = {
  fontSize: `${FONT_SIZES.lg}px`,
  fontWeight: 600,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

/**
 * The phone's sheet: the house hook trio over `BottomSheet`, stacked over the card window
 * (`layer="lightbox"`), in a portal so no ancestor's transform holds it.
 */
function PhoneSheet({isOpen, onClose, children}: {isOpen: boolean; onClose: () => void; children: ReactNode}) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const {mounted, visible, onTransitionEnd} = useTransitionPresence(isOpen);
  useScrollLock(isOpen);
  const {handleKeyDown} = useDialogFocus({isOpen, containerRef: sheetRef, initialFocusRef: sheetRef, onClose});
  if (!mounted) return null;
  return createPortal(
    <BottomSheet
      visible={visible}
      onClose={onClose}
      onTransitionEnd={onTransitionEnd}
      ariaLabel={DIALOG_NAME}
      sheetRef={sheetRef}
      onKeyDown={handleKeyDown}
      layer="lightbox"
      sheetStyle={{maxHeight: '85vh', transition: `transform 0.25s ${EASING.smooth}, opacity 0.25s ${EASING.smooth}`}}>
      <div style={SHEET_HEADER_STYLE}>
        <h2 style={DIALOG_TITLE}>{DIALOG_NAME}</h2>
        <IconButton aria-label="Close" size={36} onClick={onClose}>
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </IconButton>
      </div>
      {children}
    </BottomSheet>,
    document.body,
  );
}

const SHEET_HEADER_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: `0 ${SPACING.lg}px`,
  flexShrink: 0,
};
