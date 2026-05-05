import {useRef, useState} from 'react';
import type {LorcanaCard} from '../../cards';
import type {DetailedPairSynergy} from 'inkweave-synergy-engine';
import {EngineColumn} from './EngineColumn';
import {CommunityColumn} from './CommunityColumn';
import {CardImage, CardLightbox, RenderProfiler} from '../../../shared/components';
import {useDialogFocus} from '../../../shared/hooks/useDialogFocus';
import {useScrollLock, useTransitionPresence, useResponsive} from '../../../shared/hooks';
import {COLORS, FONTS, RADIUS, Z_INDEX} from '../../../shared/constants';

interface SynergyDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  pair: DetailedPairSynergy;
}

export function SynergyDetailModal({isOpen, onClose, pair}: SynergyDetailModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const {isMobile} = useResponsive();

  const {mounted, visible, onTransitionEnd} = useTransitionPresence(isOpen);
  useScrollLock(isOpen);

  const initialFocusRef = useRef<HTMLElement>(null);
  const {handleKeyDown} = useDialogFocus({
    isOpen,
    containerRef: modalRef,
    initialFocusRef,
    onClose,
  });

  const {cardA, cardB, aggregateScore} = pair;
  const [highlightedCard, setHighlightedCard] = useState<'a' | 'b' | null>(null);

  if (!mounted) return null;

  const cardWidth = isMobile ? 140 : 280;
  const pairKey = `${cardA.id}-${cardB.id}`;

  return (
    <RenderProfiler id="SynergyDetailModal">
      <>
        {/* Backdrop */}
        <div
          className={`overlay-transition overlay-enter ${visible ? 'overlay-visible' : ''}`}
          aria-hidden="true"
          onClick={onClose}
          data-testid="synergy-detail-backdrop"
          onTransitionEnd={onTransitionEnd}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.6)',
            zIndex: Z_INDEX.modalBackdrop,
            cursor: 'pointer',
            backdropFilter: 'blur(4px)',
          }}
        />

        {/* Centering wrapper */}
        <div
          style={{
            position: 'fixed',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: Z_INDEX.modal,
            pointerEvents: 'none',
            padding: 24,
          }}>
          {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- dialog keyboard handling (Escape to close) */}
          <div
            ref={modalRef}
            className={`overlay-transition overlay-scale overlay-enter ${visible ? 'overlay-visible' : ''}`}
            role="dialog"
            aria-modal="true"
            aria-label="Synergy detail"
            data-testid="synergy-detail-modal"
            onKeyDown={handleKeyDown}
            onTransitionEnd={onTransitionEnd}
            style={{
              width: '100%',
              maxWidth: isMobile ? 580 : 1000,
              maxHeight: 'calc(100vh - 48px)',
              overflowY: 'auto',
              background: COLORS.surface,
              borderRadius: `${RADIUS.xl}px`,
              border: `1px solid ${COLORS.surfaceBorder}`,
              boxShadow: '0 24px 64px rgba(0, 0, 0, 0.5), 0 0 1px rgba(51, 51, 85, 0.8)',
              position: 'relative',
              pointerEvents: 'auto',
            }}>
            {/* Header — pair title + close */}
            <header
              style={{
                padding: '20px 24px 0',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}>
              <h1
                style={{
                  margin: 0,
                  fontFamily: FONTS.body,
                  fontSize: isMobile ? 15 : 20,
                  fontWeight: 700,
                  color: COLORS.text,
                  lineHeight: 1.2,
                  flex: 1,
                  minWidth: 0,
                }}>
                {cardA.fullName}
                <span
                  aria-hidden="true"
                  style={{color: COLORS.textMuted, margin: '0 8px', fontWeight: 400}}>
                  ×
                </span>
                {cardB.fullName}
              </h1>
              <button
                type="button"
                aria-label="Close"
                onClick={onClose}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: 'transparent',
                  border: `1px solid ${COLORS.surfaceBorder}`,
                  color: COLORS.textMuted,
                  fontSize: 18,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  lineHeight: 1,
                  fontFamily: FONTS.body,
                }}>
                ×
              </button>
            </header>

            {/* Cards row — large card art with simple dashed connector */}
            <div
              style={{
                padding: '20px 24px 0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: isMobile ? 12 : 28,
              }}>
              <PairCardImage
                card={cardA}
                width={cardWidth}
                dimmed={highlightedCard === 'b'}
                highlighted={highlightedCard === 'a'}
              />
              <PairConnector />
              <PairCardImage
                card={cardB}
                width={cardWidth}
                dimmed={highlightedCard === 'a'}
                highlighted={highlightedCard === 'b'}
              />
            </div>

            {/* Comparison-detail panel — engine column + community column */}
            <div
              style={{
                padding: '20px 24px 24px',
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                gap: 20,
                alignItems: 'flex-start',
              }}>
              <div key={`engine-${pairKey}`}>
                <EngineColumn
                  pair={pair}
                  engineScore={aggregateScore}
                  onHighlight={setHighlightedCard}
                />
              </div>
              <div key={`community-${pairKey}`}>
                <CommunityColumn pair={pair} engineScore={aggregateScore} />
              </div>
            </div>
          </div>
        </div>
      </>
    </RenderProfiler>
  );
}

// ── Subcomponents ──

function PairCardImage({
  card,
  width,
  dimmed,
  highlighted,
}: {
  card: LorcanaCard;
  width: number;
  dimmed?: boolean;
  highlighted?: boolean;
}) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const canEnlarge = !!card.imageUrl;
  // 264:368 aspect ratio (Lorcana card proportions)
  const height = Math.round((width * 368) / 264);

  return (
    <div
      style={{
        flex: '0 0 auto',
        opacity: dimmed ? 0.4 : 1,
        transition: 'opacity 0.2s ease, filter 0.2s ease, transform 0.2s ease',
        filter: highlighted ? 'drop-shadow(0 0 8px rgba(212, 175, 55, 0.6))' : undefined,
        transform: highlighted ? 'scale(1.03)' : undefined,
      }}>
      <button
        type="button"
        aria-label={canEnlarge ? 'Enlarge card image' : undefined}
        disabled={!canEnlarge}
        onClick={canEnlarge ? () => setLightboxOpen(true) : undefined}
        style={{
          border: 'none',
          background: 'none',
          padding: 0,
          width,
          cursor: canEnlarge ? 'pointer' : 'default',
        }}>
        <CardImage
          src={card.imageUrl}
          alt={card.fullName}
          width={width}
          height={height}
          inkColor={card.ink}
          cost={card.cost}
          borderRadius={14}
          style={{width, height: 'auto'}}
        />
      </button>
      {lightboxOpen && card.imageUrl && (
        <CardLightbox
          src={card.imageUrl}
          alt={card.fullName}
          isLocation={card.type === 'Location'}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </div>
  );
}

function PairConnector() {
  return (
    <div
      aria-hidden="true"
      style={{
        flex: '0 1 auto',
        minWidth: 32,
        maxWidth: 80,
        height: 2,
        backgroundImage: `repeating-linear-gradient(to right, ${COLORS.primary500} 0, ${COLORS.primary500} 6px, transparent 6px, transparent 12px)`,
        backgroundSize: '12px 2px',
        opacity: 0.7,
      }}
    />
  );
}
