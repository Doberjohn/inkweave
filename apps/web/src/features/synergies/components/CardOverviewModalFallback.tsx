import {useEffect} from 'react';
import Skeleton from 'react-loading-skeleton';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {useScrollLock, useTransitionPresence} from '../../../shared/hooks';
import {
  CENTERING_WRAPPER_STYLE,
  CLOSE_BUTTON_SIZE,
  DEFAULT_BODY_STYLE,
  MODAL_BACKDROP_STYLE,
  MODAL_FRAME_STYLE,
  MODAL_HEADER_STYLE,
  modalCardSize,
  pickCardsRowStyle,
  pickModalShellStyle,
  pickModalTitleStyle,
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

const CLOSE_BUTTON_SLOT_STYLE: React.CSSProperties = {
  width: CLOSE_BUTTON_SIZE,
  height: CLOSE_BUTTON_SIZE,
  flexShrink: 0,
};

const BODY_STYLE: React.CSSProperties = {...DEFAULT_BODY_STYLE, overflow: 'hidden'};

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
 * records the card tile as the element to return focus to. Clicking the scrim or pressing Escape
 * closes it, like the modal.
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
              {/* Holds the close button's place: it sets the header's height, so everything
                  below sits exactly where the modal's will. */}
              <div aria-hidden="true" style={CLOSE_BUTTON_SLOT_STYLE} />
            </div>
            <div style={BODY_STYLE}>
              <div style={pickCardsRowStyle({isMobile, cardWidth, cardHeight})}>
                {/* inline + block: no trailing <br> or line box, so the placeholder is exactly
                    the card's height and the synergy column below it lines up (mobile). */}
                <Skeleton width={cardWidth} height={cardHeight} borderRadius={14} inline style={{display: 'block'}} />
                <div style={{minWidth: 0}}>
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
