import {useEffect, type CSSProperties, type RefObject} from 'react';
import Skeleton from 'react-loading-skeleton';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {COLORS, FONT_SIZES, RADIUS} from '../../../shared/constants';
import {IconButton} from '../../../shared/components/IconButton';
import {printingsOf, useScrollLock, useTransitionPresence} from '../../../shared/hooks';
import {CardTranslationToggle} from '../../../shared/components/CardTranslationToggle';
import {PrintingPills} from '../../../shared/components/PrintingPills';
import {
  CENTERING_WRAPPER_STYLE,
  CLOSE_BUTTON_SIZE,
  DEFAULT_BODY_STYLE,
  MODAL_BACKDROP_STYLE,
  MODAL_FRAME_STYLE,
  MODAL_HEADER_STYLE,
  modalCardSize,
  pickCardColumnLayout,
  pickCardsRowStyle,
  pickModalShellStyle,
  pickModalTitleStyle,
  pickSynergyColumnLayout,
} from './cardOverviewModalStyles';

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
  fontSize: FONT_SIZES.xl,
  flexShrink: 0,
};

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
      ×
    </IconButton>
  );
}

const BODY_STYLE: CSSProperties = {...DEFAULT_BODY_STYLE, overflow: 'hidden'};

const HIDDEN: CSSProperties = {visibility: 'hidden'};
const noop = () => {};

/**
 * The modal's printing pills and translation toggle (ModalCardArt.tsx), invisible: rendered
 * only where the modal renders them and in the same wrappers (the header on desktop, under the
 * card on mobile), they hold exactly the space the real controls take, so nothing moves at the
 * handoff. visibility:hidden also keeps them out of the focus order and the accessibility tree.
 */
function ReservedArtControls({card, isMobile}: {card: LorcanaCard; isMobile: boolean}) {
  const printings = printingsOf(card);
  const toggle = card.scanLanguage ? (
    <span style={HIDDEN}>
      <CardTranslationToggle shown={false} onToggle={noop} />
    </span>
  ) : null;
  if (isMobile) {
    return (
      <>
        <PrintingPills printings={printings} index={0} onSelect={noop} isMobile style={HIDDEN} />
        {toggle}
      </>
    );
  }
  return (
    <>
      {printings.length > 1 && (
        <span style={HIDDEN}>
          <PrintingPills printings={printings} index={0} onSelect={noop} />
        </span>
      )}
      {toggle}
    </>
  );
}

interface CardOverviewModalFallbackProps {
  card: LorcanaCard;
  isMobile: boolean;
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
export function CardOverviewModalFallback({card, isMobile, onClose}: CardOverviewModalFallbackProps) {
  const {visible} = useTransitionPresence(true);
  useScrollLock(true);
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const {cardWidth, cardHeight} = modalCardSize(isMobile);
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
              <div style={pickModalTitleStyle(isMobile)}>{card.fullName}</div>
              {!isMobile && <ReservedArtControls card={card} isMobile={false} />}
              {/* The modal's own ×: it sets the header's height, so everything below sits
                  exactly where the modal's will. It never takes focus (see above). */}
              <ModalCloseButton onClose={onClose} />
            </div>
            <div style={BODY_STYLE}>
              <div style={pickCardsRowStyle({isMobile, cardWidth, cardHeight})}>
                <div style={pickCardColumnLayout(isMobile)}>
                  {/* inline + block: no trailing <br> or line box, so the placeholder is exactly
                      the card's height and the synergy column below it lines up (mobile). */}
                  <Skeleton
                    width={cardWidth}
                    height={cardHeight}
                    borderRadius={RADIUS.xl}
                    inline
                    style={{display: 'block'}}
                  />
                  {isMobile && <ReservedArtControls card={card} isMobile />}
                </div>
                <div style={pickSynergyColumnLayout(isMobile, cardHeight)}>
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
