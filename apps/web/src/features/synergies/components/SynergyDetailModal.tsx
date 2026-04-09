import {useRef, useState, useEffect} from 'react';
import {useNavigate} from 'react-router-dom';
import type {LorcanaCard} from '../../cards';
import {useCardPreviewHandlers, useCardPreview} from '../../cards';
import type {DetailedPairSynergy} from 'inkweave-synergy-engine';
import {getStrengthTier} from '../utils';
import {QuickVoteControl} from '../../voting/components';
import {useQuickVote} from '../../voting/hooks';
import {CardImage, CardLightbox, RenderProfiler, ConnectionGroup, groupConnections} from '../../../shared/components';
import {useDialogFocus} from '../../../shared/hooks/useDialogFocus';
import {useScrollLock, useTransitionPresence, useResponsive} from '../../../shared/hooks';
import {COLORS, FONT_SIZES, SPACING, RADIUS, Z_INDEX} from '../../../shared/constants';

interface SynergyDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  pair: DetailedPairSynergy;
}

export function SynergyDetailModal({
  isOpen,
  onClose,
  pair,
}: SynergyDetailModalProps) {
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

  // Hide any card popover immediately when modal starts closing (before exit animation)
  const {hidePreview} = useCardPreview();
  useEffect(() => {
    if (!isOpen) hidePreview();
  }, [isOpen, hidePreview]);

  const navigate = useNavigate();
  const {cardA, cardB, connections, aggregateScore} = pair;
  const tier = getStrengthTier(aggregateScore);
  const quickVote = useQuickVote(cardA.id, cardB.id);
  const [highlightedCard, setHighlightedCard] = useState<'a' | 'b' | null>(null);
  const connectionGroups = groupConnections(connections);

  if (!mounted) return null;

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
            maxWidth: 580,
            maxHeight: 'calc(100vh - 48px)',
            overflowY: 'auto',
            background: COLORS.surface,
            borderRadius: `${RADIUS.xl}px`,
            border: `1px solid ${COLORS.surfaceBorder}`,
            boxShadow: '0 24px 64px rgba(0, 0, 0, 0.5), 0 0 1px rgba(51, 51, 85, 0.8)',
            position: 'relative',
            pointerEvents: 'auto',
          }}>
          {/* Card images + connector (centered) */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '24px 12px 0',
            }}>
            <PairCardImage card={cardA} isMobile={isMobile} dimmed={highlightedCard === 'b'} highlighted={highlightedCard === 'a'} />
            <Connector score={aggregateScore} tier={tier} isMobile={isMobile} />
            <PairCardImage card={cardB} isMobile={isMobile} dimmed={highlightedCard === 'a'} highlighted={highlightedCard === 'b'} />
          </div>

          {/* Aggregate tier label */}
          <div style={{textAlign: 'center', padding: '14px 24px 20px'}}>
            <h2
              style={{
                fontSize: `${FONT_SIZES.base}px`,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: COLORS.textMuted,
                margin: 0,
              }}>
              <span style={{color: tier.color}}>{tier.label}</span> Synergy
            </h2>
          </div>

          {/* Connections list — shown before vote so users read the reasoning first */}
          {connectionGroups.length > 0 && (
            <div style={{margin: '0 24px 20px', display: 'flex', flexDirection: 'column', gap: `${SPACING.sm}px`}}>
              {connectionGroups.map((group) => (
                <ConnectionGroup
                  key={group.key}
                  group={group}
                  cardA={cardA}
                  cardB={cardB}
                  showScoreBadge
                  onHighlight={setHighlightedCard}
                />
              ))}
            </div>
          )}

          {/* Quick vote — after explanation, users can make an informed judgment */}
          <div key={`vote-${cardA.id}-${cardB.id}`} style={{padding: '0 24px 24px'}}>
            <QuickVoteControl
              state={quickVote.state}
              onVote={quickVote.vote}
              distribution={quickVote.distribution}
              distributionFailed={quickVote.distributionFailed}
              userChoice={quickVote.userChoice}
              error={quickVote.error}
              onRateInDetail={() => navigate(`/vote/${cardA.id}/${cardB.id}`)}
            />
          </div>

        </div>
      </div>
    </>
    </RenderProfiler>
  );
}

// ── Subcomponents ──

function PairCardImage({card, isMobile, dimmed, highlighted}: {card: LorcanaCard; isMobile?: boolean; dimmed?: boolean; highlighted?: boolean}) {
  const {previewHandlers} = useCardPreviewHandlers({card});
  const [lightboxOpen, setLightboxOpen] = useState(false);

  return (
    <div
      style={{
        flex: '1 1 0',
        minWidth: 0,
        maxWidth: 160,
        display: 'flex',
        justifyContent: 'center',
        opacity: dimmed ? 0.4 : 1,
        transition: 'opacity 0.2s ease, filter 0.2s ease, transform 0.2s ease',
        filter: highlighted ? 'drop-shadow(0 0 8px rgba(212, 175, 55, 0.6))' : undefined,
        transform: highlighted ? 'scale(1.03)' : undefined,
      }}>
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- mobile-only tap-to-enlarge; lightbox is supplementary, not a primary action */}
      <div
        {...(isMobile ? {} : previewHandlers)}
        onClick={isMobile && card.imageUrl ? () => setLightboxOpen(true) : undefined}
        style={{cursor: isMobile ? 'pointer' : undefined, width: '100%'}}>
        <CardImage
          src={card.imageUrl}
          alt={card.fullName}
          width={160}
          height={224}
          inkColor={card.ink}
          cost={card.cost}
          borderRadius={10}
          style={{width: '100%', height: 'auto', maxWidth: 160}}
        />
      </div>
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

function Connector({
  score,
  tier,
  isMobile,
}: {
  score: number;
  tier: ReturnType<typeof getStrengthTier>;
  isMobile: boolean;
}) {
  const lineColor = `${tier.color}59`; // ~35% opacity
  const circleBorderColor = `${tier.color}80`; // ~50% opacity
  const circleGlow = `${tier.color}1a`; // ~10% opacity
  const size = isMobile ? 32 : 44;
  const fontSize = isMobile ? FONT_SIZES.base : FONT_SIZES.xl;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        flexShrink: 0,
        minWidth: isMobile ? 44 : 140,
        margin: isMobile ? '0 6px' : '0 2px',
      }}>
      {!isMobile && <div style={{width: 3}} />}
      <DashedLine color={lineColor} isMobile={isMobile} />
      {!isMobile && <div style={{width: 3}} />}
      <div
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: `${fontSize}px`,
          fontWeight: 700,
          flexShrink: 0,
          border: `2px solid ${circleBorderColor}`,
          background: `${tier.color}0f`,
          color: tier.color,
          boxShadow: `0 0 24px ${circleGlow}`,
        }}>
        {score}
      </div>
      {!isMobile && <div style={{width: 3}} />}
      <DashedLine color={lineColor} isMobile={isMobile} />
      {!isMobile && <div style={{width: 3}} />}
    </div>
  );
}


function DashedLine({color, isMobile}: {color: string; isMobile: boolean}) {
  return (
    <svg
      style={{flex: '1 1 6px', maxWidth: isMobile ? 14 : 44, overflow: 'visible'}}
      height="2"
      preserveAspectRatio="none">
      <line
        x1="0"
        y1="1"
        x2="100%"
        y2="1"
        stroke={color}
        strokeWidth="1.5"
        strokeDasharray={isMobile ? '3 3' : '6 6'}
      />
    </svg>
  );
}
