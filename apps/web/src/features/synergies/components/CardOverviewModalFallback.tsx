import {useEffect, type CSSProperties, type RefObject} from 'react';
import Skeleton from 'react-loading-skeleton';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {COLORS, ICON_SIZE, RADIUS} from '../../../shared/constants';
import {IconButton} from '../../../shared/components/IconButton';
import {InkCardPlaceholder} from '../../../shared/components/InkCardPlaceholder';
import {
  hasForeignScan,
  printingsOf,
  useScrollLock,
  useTransitionPresence,
} from '../../../shared/hooks';
import {CardTranslationToggle} from '../../../shared/components/CardTranslationToggle';
import {ModalCardTitle} from './ModalCardTitle';
import {
  CARD_WITH_COPIES_STYLE,
  CENTERING_WRAPPER_STYLE,
  CLOSE_BUTTON_SIZE,
  copiesRowHeight,
  DEFAULT_BODY_STYLE,
  desktopCardRowHeight,
  MODAL_BACKDROP_STYLE,
  MODAL_FRAME_STYLE,
  MODAL_HEADER_STYLE,
  pickCardColumnLayout,
  pickCardsRowStyle,
  pickModalShellStyle,
  pickSynergyColumnLayout,
} from './cardOverviewModalStyles';
import {useModalCardSize} from './useModalCardSize';

/**
 * Right-column placeholder shown while the per-card synergy JSON is in flight
 * (usePrecomputedSynergies.isLoading === true). Mirrors the post-load layout:
 * 2 group sections, each with a small label rect + 2-line description rect +
 * 3-tile mini-card grid. Without this, slow connections (3G + Set 12-sized
 * synergy files) made the modal show "No synergies yet" during load — which
 * read as a true empty state and disappeared once data arrived. The skeleton
 * makes the loading transition obvious instead of misleading.
 */
export function SynergiesLoadingSkeleton() {
  return (
    <>
      <div
        data-testid="card-overview-loading"
        aria-busy="true"
        aria-label="Loading synergies"
        style={{display: 'flex', flexDirection: 'column', gap: 20}}>
        {Array.from({length: 2}).map((_, groupIdx) => (
          <div key={groupIdx} style={{display: 'flex', flexDirection: 'column', gap: 8}}>
            {/* Label tag */}
            <Skeleton width={92} height={20} borderRadius={2} />
            {/* Cream callout description (2 lines suggested) */}
            <Skeleton height={36} borderRadius={4} />
            {/* Mini-card tile grid — matches modal's gridColumns={4}, 3 visible per group */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 8,
                marginTop: 4,
              }}>
              {Array.from({length: 3}).map((_, tileIdx) => (
                <Skeleton key={tileIdx} height={170} borderRadius={5} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

const CLOSE_BUTTON_STYLE: CSSProperties = {
  borderRadius: '50%',
  border: `1px solid ${COLORS.surfaceBorder}`,
  // The brand gold, like the BACK link that shares the header in the pair view.
  color: COLORS.primary,
  flexShrink: 0,
};

/**
 * The ×, drawn rather than typed: a typed × sits on its font's math axis, below the middle of
 * the line box, so it rode low in the circle. Drawn around the viewBox's center, it sits dead
 * center in the button.
 */
function CloseGlyph() {
  return (
    <svg width={ICON_SIZE.sm} height={ICON_SIZE.sm} viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
      <path d="M5 5l6 6M11 5l-6 6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

/**
 * The modal's close (×) button. The loading shell renders it too, so it can be dismissed the
 * same way, by anyone (a real button, reachable by screen readers), from the same spot.
 */
export function ModalCloseButton({onClose, focusRef}: {onClose: () => void; focusRef?: RefObject<HTMLButtonElement | null>}) {
  return (
    <IconButton
      type="button"
      aria-label="Close"
      onClick={onClose}
      ref={focusRef}
      size={CLOSE_BUTTON_SIZE}
      style={CLOSE_BUTTON_STYLE}>
      <CloseGlyph />
    </IconButton>
  );
}

const BODY_STYLE: CSSProperties = {...DEFAULT_BODY_STYLE, overflow: 'hidden'};

const HIDDEN: CSSProperties = {visibility: 'hidden'};
const noop = () => {};

/**
 * The translation toggle, invisible, for a card with a foreign scan among its printings: the
 * space the modal's takes, under the card on mobile and in the header on desktop.
 * visibility:hidden also keeps it out of the focus order and the accessibility tree.
 */
function ReservedTranslationToggle({card}: {card: LorcanaCard}) {
  if (!hasForeignScan(card)) return null;
  return (
    <span style={HIDDEN}>
      <CardTranslationToggle shown={false} onToggle={noop} />
    </span>
  );
}

interface CardPlaceholderProps {
  card: LorcanaCard;
  isMobile: boolean;
  /** The window holds the copies row under its card. */
  copiesRow: boolean;
  size: {cardWidth: number; cardHeight: number};
}

/**
 * The card's placeholder, with what the modal puts under a phone's card (ModalCardArt.tsx),
 * invisible: the copies row where the window holds one, and the translation toggle. Laid out as
 * the modal lays them out, they hold exactly the space the real ones take, so nothing moves at
 * the handoff. Under a desktop card the copies row's room is the row's own
 * (`desktopCardRowHeight`), and the toggle is held in the header.
 */
function CardPlaceholder({card, isMobile, copiesRow, size: {cardWidth, cardHeight}}: CardPlaceholderProps) {
  return (
    <div style={pickCardColumnLayout(isMobile)}>
      <div style={CARD_WITH_COPIES_STYLE}>
        {/* A block with no line box after it, so the placeholder is exactly the card's
            height and the synergy column below it lines up (mobile). */}
        <div
          style={{
            position: 'relative',
            width: cardWidth,
            height: cardHeight,
            borderRadius: RADIUS.xl,
            overflow: 'hidden',
          }}>
          <InkCardPlaceholder ink={card.ink} ink2={card.ink2} />
        </div>
        {isMobile && copiesRow && <div style={{width: cardWidth, height: copiesRowHeight(cardWidth)}} />}
      </div>
      {isMobile && <ReservedTranslationToggle card={card} />}
    </div>
  );
}

interface CardOverviewModalFallbackProps {
  card: LorcanaCard;
  isMobile: boolean;
  /**
   * The printing the open names (CardModalContext's `initialPrintingId`), whose number the
   * title reads, as the modal's will.
   */
  printingId?: string | null;
  /** The window holds the copies row under its card (`useHoldCopiesRow`), as the modal will. */
  copiesRow?: boolean;
  onClose: () => void;
}

/**
 * Stands in for CardOverviewModal while its chunk downloads (#640), so a tap on a card answers at
 * once: the scrim and panel play the modal's opening transition, with the card's name and the
 * loading layout inside. The modal then mounts already visible (CardModalContext's
 * `skipEnterTransition`) and replaces this without a second entrance.
 *
 * It is a loading status, not a dialog. It never takes focus, so the modal's useDialogFocus still
 * records the card tile as the element to return focus to: moving focus in here would bounce it
 * three times in the few hundred milliseconds the shell usually lasts (shell, tile, modal).
 * Clicking the scrim or its ×, or pressing Escape, closes it, like the modal.
 */
export function CardOverviewModalFallback({
  card,
  isMobile,
  printingId = null,
  copiesRow = false,
  onClose,
}: CardOverviewModalFallbackProps) {
  const {visible} = useTransitionPresence(true);
  useScrollLock(true);
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const {cardWidth, cardHeight} = useModalCardSize(isMobile, copiesRow);
  const rowHeight = desktopCardRowHeight({cardWidth, cardHeight, copiesRow});
  const visibleClass = visible ? ' overlay-visible' : '';
  return (
    <>
      <div
        className={`overlay-transition overlay-enter${visibleClass}`}
        aria-hidden="true"
        onClick={onClose}
        data-testid="card-overview-fallback-backdrop"
        style={MODAL_BACKDROP_STYLE}
      />
      <div style={CENTERING_WRAPPER_STYLE}>
        <div style={MODAL_FRAME_STYLE}>
          <div
            className={`overlay-transition overlay-scale overlay-enter${visibleClass}`}
            role="status"
            aria-label={`Loading ${card.fullName}`}
            data-testid="card-overview-fallback"
            style={pickModalShellStyle(isMobile)}>
            <div style={MODAL_HEADER_STYLE}>
              <ModalCardTitle
                card={card}
                isMobile={isMobile}
                printing={printingsOf(card).find((printing) => printing.key === printingId)}
                as="div"
              />
              {!isMobile && <ReservedTranslationToggle card={card} />}
              {/* The modal's own ×: it sets the header's height, so everything below sits
                  exactly where the modal's will. It never takes focus (see above). */}
              <ModalCloseButton onClose={onClose} />
            </div>
            <div style={BODY_STYLE}>
              <div style={pickCardsRowStyle({isMobile, cardWidth, rowHeight})}>
                <CardPlaceholder card={card} isMobile={isMobile} copiesRow={copiesRow} size={{cardWidth, cardHeight}} />
                <div style={pickSynergyColumnLayout(isMobile, rowHeight)}>
                  <SynergiesLoadingSkeleton />
                </div>
              </div>
              {/* The modal's collapsed comparison panel: zero height, but inside the body gap. */}
              <div aria-hidden="true" />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
