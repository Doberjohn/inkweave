import {useLayoutEffect, useMemo, useRef, useState} from 'react';
import type {DetailedPairSynergy, LorcanaCard} from 'inkweave-synergy-engine';
import type {SynergyGroup as SynergyGroupData} from '../types';
import {SynergyGroup} from './SynergyGroup';
import {EngineColumn} from './EngineColumn';
import {CommunityColumn} from './CommunityColumn';
import {CardImage, CardLightbox, RenderProfiler} from '../../../shared/components';
import {useDialogFocus} from '../../../shared/hooks/useDialogFocus';
import {useScrollLock, useTransitionPresence} from '../../../shared/hooks';
import {getDominantScore, getStrengthTier} from '../utils';
import {COLORS, FONTS, RADIUS, Z_INDEX} from '../../../shared/constants';

const FLIP_DURATION = 480;
const FLIP_EASING = 'cubic-bezier(0.2, 0.8, 0.2, 1)';

interface CardOverviewModalProps {
  isOpen: boolean;
  card: LorcanaCard;
  synergies: SynergyGroupData[];
  onClose: () => void;
  /** Resolves a clicked card into its full pair-synergy data (engine + connection details). */
  getPairSynergies: (clickedCard: LorcanaCard, groupKey?: string) => DetailedPairSynergy | null;
  isMobile?: boolean;
}

/**
 * Card overview modal — replaces the full-page card detail view with a modal-on-top-of-current-page experience.
 *
 * Default mode (matches `apps/web/public/mockups/card-modal-base.html`):
 * - Header: card name (h1) + close button
 * - Chip row: synergy group filters with count badges (tier-colored)
 * - Hero divider (gold gradient line)
 * - Cards row: big card image (left) + group stack (right)
 *
 * Comparison mode — entered when a synergy mini-tile is clicked:
 * - chip-row, hero-divider, info-col fade out (250ms)
 * - compare-card grows from clicked tile rect to 380×530 next to A (FLIP, 480ms cubic-bezier)
 * - pair-connector dashed lines + score badge fade in (250ms, delayed 200ms)
 * - comparison-detail panel (engine + community columns) expands max-height (480ms) + opacity (300ms, delayed 250ms)
 * - compare-back button replaces chip-row visually (top-left)
 *
 * State machine:
 * - default — chip-row inactive, all groups visible with preview-sized mini-grid
 * - focused — chip pressed → only that group visible, expanded mini-grid (up to 11 cards + More tile)
 * - comparison — synergy card clicked → in-place pair detail, both A and B side-by-side
 */
export function CardOverviewModal({
  isOpen,
  card,
  synergies,
  onClose,
  getPairSynergies,
  isMobile = false,
}: CardOverviewModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const initialFocusRef = useRef<HTMLElement>(null);
  const compareCardRef = useRef<HTMLDivElement>(null);
  const flipStartRectRef = useRef<DOMRect | null>(null);
  const {mounted, visible, onTransitionEnd} = useTransitionPresence(isOpen);
  useScrollLock(isOpen);

  const [activeGroupFilter, setActiveGroupFilter] = useState<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [comparisonPair, setComparisonPair] = useState<DetailedPairSynergy | null>(null);
  const [highlightedCard, setHighlightedCard] = useState<'a' | 'b' | null>(null);

  const exitComparison = () => {
    setComparisonPair(null);
    setHighlightedCard(null);
  };

  const {handleKeyDown: handleModalKeyDown} = useDialogFocus({
    isOpen,
    containerRef: modalRef,
    initialFocusRef,
    onClose: comparisonPair ? exitComparison : onClose,
  });

  // Reset comparison when the modal's card changes — prev pair refers to the prior card
  const [prevCardId, setPrevCardId] = useState(card.id);
  if (card.id !== prevCardId) {
    setPrevCardId(card.id);
    setComparisonPair(null);
    setHighlightedCard(null);
  }

  // Reset comparison state when the modal closes — render-time reset mirrors the card-id
  // pattern above and avoids the cascading-render warning from setState-in-effect.
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (!isOpen) {
      setComparisonPair(null);
      setHighlightedCard(null);
    }
  }

  // Render the engine-supplied tagline (short headline) in place of the long description.
  const visibleGroups = useMemo(() => {
    const base = activeGroupFilter
      ? synergies.filter((g) => g.groupKey === activeGroupFilter)
      : synergies;
    return base.map((g) => ({...g, description: g.tagline}));
  }, [synergies, activeGroupFilter]);

  // FLIP: when comparisonPair becomes set, animate the destination card from the clicked tile's rect.
  useLayoutEffect(() => {
    if (!comparisonPair) return;
    const el = compareCardRef.current;
    const start = flipStartRectRef.current;
    if (!el || !start) return;
    const end = el.getBoundingClientRect();
    const dx = start.left - end.left;
    const dy = start.top - end.top;
    const sx = start.width / end.width;
    const sy = start.height / end.height;

    el.style.transition = 'none';
    el.style.transform = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;
    // Force reflow so the inverse transform is committed before we animate.
    void el.offsetWidth;
    el.style.transition = `transform ${FLIP_DURATION}ms ${FLIP_EASING}`;
    el.style.transform = '';
  }, [comparisonPair]);

  if (!mounted) return null;

  // 1:1 with mockup: 380×530 card art, 530px-tall cards-row, info-col scrolls inside that height.
  const cardWidth = isMobile ? 240 : 380;
  const cardHeight = Math.round((cardWidth * 368) / 264);

  const toggleChip = (key: string) => {
    setActiveGroupFilter((prev) => (prev === key ? null : key));
  };

  // "+N more" tile click → focus on that group (same end state as clicking the chip)
  const handleShowAll = (groupKey: string) => setActiveGroupFilter(groupKey);

  // Mini-tile click → enter comparison mode in-place (resolve pair via parent-supplied lookup,
  // capture the clicked tile's rect for FLIP animation).
  const handleSynergyCardClick = (clickedCard: LorcanaCard, groupKey?: string) => {
    const pair = getPairSynergies(clickedCard, groupKey);
    if (!pair || pair.connections.length === 0) return;
    const tileEl = modalRef.current?.querySelector(
      `[data-card-id="${clickedCard.id}"]`,
    ) as HTMLElement | null;
    flipStartRectRef.current = tileEl ? tileEl.getBoundingClientRect() : null;
    setComparisonPair(pair);
  };

  const inComparison = !!comparisonPair;
  const dataMode = inComparison ? 'comparison' : 'default';

  return (
    <RenderProfiler id="CardOverviewModal">
      <>
        {/* Backdrop */}
        <div
          className={`overlay-transition overlay-enter ${visible ? 'overlay-visible' : ''}`}
          aria-hidden="true"
          onClick={onClose}
          data-testid="card-overview-backdrop"
          onTransitionEnd={onTransitionEnd}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.6)',
            zIndex: Z_INDEX.modalBackdrop,
            cursor: 'pointer',
            backdropFilter: 'blur(6px)',
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
            padding: '24px',
          }}>
          {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- dialog keyboard handling (Escape to close) */}
          <div
            ref={modalRef}
            className={`overlay-transition overlay-scale overlay-enter ${visible ? 'overlay-visible' : ''}`}
            role="dialog"
            aria-modal="true"
            aria-label={`${card.fullName} synergies`}
            data-testid="card-overview-modal"
            data-state={activeGroupFilter ? 'focused' : 'default'}
            data-mode={dataMode}
            data-highlighted={highlightedCard ?? undefined}
            onKeyDown={handleModalKeyDown}
            onTransitionEnd={onTransitionEnd}
            style={{
              width: isMobile ? '100%' : 1000,
              maxWidth: isMobile ? 580 : 'calc(100vw - 48px)',
              maxHeight: 'calc(100vh - 48px)',
              background: COLORS.surface,
              borderRadius: `${RADIUS.card}px`,
              border: `1px solid ${COLORS.surfaceBorder}`,
              boxShadow:
                '0 24px 60px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(212, 175, 55, 0.08)',
              position: 'relative',
              pointerEvents: 'auto',
              fontFamily: FONTS.body,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}>
            {/* Header */}
            <header
              style={{
                padding: '20px 24px 0',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                flexWrap: 'wrap',
              }}>
              {inComparison ? (
                // BACK button takes the h1 slot in focused state — same row as close button.
                <BackButton onClick={exitComparison} />
              ) : (
                <h1
                  style={{
                    margin: 0,
                    fontFamily: FONTS.body,
                    fontSize: isMobile ? 18 : 22,
                    fontWeight: 700,
                    color: COLORS.text,
                    lineHeight: 1.2,
                    flex: 1,
                    minWidth: 0,
                  }}>
                  {card.fullName}
                </h1>
              )}
              {/* Spacer pushes close button to the right when BACK is in the slot (BACK doesn't have flex:1) */}
              {inComparison && <div style={{flex: 1}} />}
              <CloseButton onClose={onClose} />
            </header>

            {/* Chip row — collapses entirely in comparison mode (no chip space wasted; back button is in the header row instead). */}
            {synergies.length > 0 && !inComparison && (
              <div
                style={{
                  padding: '14px 24px 0',
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 8,
                }}>
                {synergies.map((group) => {
                  const topScore = getDominantScore(group.synergies);
                  const tier = getStrengthTier(topScore);
                  const isActive = activeGroupFilter === group.groupKey;
                  const isInactive = activeGroupFilter !== null && !isActive;
                  return (
                    <button
                      key={group.groupKey}
                      type="button"
                      onClick={() => toggleChip(group.groupKey)}
                      aria-pressed={isActive}
                      title={`${group.synergies.length} cards · top score ${topScore}`}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '7px 14px',
                        background: isActive
                          ? 'rgba(212, 175, 55, 0.12)'
                          : COLORS.surfaceAlt,
                        border: `1px solid ${isActive ? COLORS.primary500 : COLORS.surfaceBorder}`,
                        borderRadius: 18,
                        fontSize: 13,
                        color: isInactive ? COLORS.textMuted : COLORS.text,
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        fontWeight: isActive ? 600 : 500,
                        opacity: isInactive ? 0.55 : 1,
                        transition:
                          'border-color 0.15s, background 0.15s, color 0.15s, opacity 0.15s',
                      }}>
                      <span style={{lineHeight: 1}}>{group.label}</span>
                      <span
                        style={{
                          padding: '2px 9px',
                          borderRadius: 11,
                          fontSize: 11,
                          fontWeight: 700,
                          lineHeight: 1.3,
                          background: tier.bg,
                          color: tier.color,
                        }}>
                        {group.synergies.length}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Hero divider — present in default state to separate header/chips from cards. Collapses in comparison mode. */}
            {synergies.length > 0 && !inComparison && (
              <hr
                aria-hidden="true"
                style={{
                  height: 1,
                  border: 'none',
                  background: `linear-gradient(90deg, transparent, ${COLORS.primary500} 50%, transparent)`,
                  margin: '16px 0 0',
                }}
              />
            )}

            {/* Modal body — flex column. Cards-row sits above optional comparison-detail. */}
            <div
              style={{
                flex: 1,
                minHeight: 0,
                padding: '20px 24px 24px',
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
                overflowY: isMobile || inComparison ? 'auto' : 'hidden',
                position: 'relative',
              }}>
              {/* Cards row — fixed 530px height. Cards stay put; info-col scrolls inside.
                  In comparison mode, compare-card + connector overlay this row. */}
              <div
                style={{
                  display: isMobile ? 'flex' : 'grid',
                  flexDirection: isMobile ? 'column' : undefined,
                  gridTemplateColumns: isMobile ? undefined : `${cardWidth}px 1fr`,
                  gap: 28,
                  alignItems: 'stretch',
                  height: isMobile ? undefined : cardHeight,
                  flexShrink: 0,
                  overflow: 'visible',
                  position: 'relative',
                }}>
                {/* Card A (the modal's selected card) — anchored top-left */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: isMobile ? 'center' : 'flex-start',
                    alignItems: 'flex-start',
                    flexShrink: 0,
                    transition: 'opacity 0.2s ease, filter 0.2s ease, transform 0.2s ease',
                    opacity: highlightedCard === 'b' ? 0.4 : 1,
                    filter:
                      highlightedCard === 'a'
                        ? 'drop-shadow(0 0 8px rgba(212, 175, 55, 0.6))'
                        : undefined,
                    transform: highlightedCard === 'a' ? 'scale(1.03)' : undefined,
                  }}>
                  <button
                    type="button"
                    aria-label={card.imageUrl ? 'Enlarge card image' : undefined}
                    disabled={!card.imageUrl}
                    onClick={card.imageUrl ? () => setLightboxOpen(true) : undefined}
                    style={{
                      border: 'none',
                      background: 'none',
                      padding: 0,
                      width: cardWidth,
                      cursor: card.imageUrl ? 'pointer' : 'default',
                    }}>
                    <CardImage
                      src={card.imageUrl}
                      alt={card.fullName}
                      width={cardWidth}
                      height={cardHeight}
                      inkColor={card.ink}
                      cost={card.cost}
                      borderRadius={14}
                      style={{width: cardWidth, height: 'auto'}}
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

                {/* Info-col — group stack. Hidden in comparison mode. */}
                <section
                  aria-label="Synergies"
                  style={{
                    minWidth: 0,
                    minHeight: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 18,
                    maxHeight: isMobile ? undefined : cardHeight,
                    overflowY: isMobile ? 'visible' : 'auto',
                    padding: isMobile ? 0 : '0 14px',
                    opacity: inComparison ? 0 : 1,
                    pointerEvents: inComparison ? 'none' : 'auto',
                    transition: 'opacity 250ms ease-out',
                  }}>
                  {synergies.length === 0 ? (
                    <div
                      data-testid="card-overview-empty"
                      style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        textAlign: 'center',
                        padding: 24,
                        gap: 8,
                      }}>
                      <p style={{margin: 0, color: COLORS.text, fontSize: 14, fontWeight: 600}}>
                        No synergies yet
                      </p>
                      <p
                        style={{
                          margin: 0,
                          color: COLORS.textMuted,
                          fontSize: 12,
                          lineHeight: 1.5,
                          maxWidth: 280,
                        }}>
                        This card may match new rules as the engine evolves.
                      </p>
                    </div>
                  ) : (
                    visibleGroups.map((group) => (
                      <SynergyGroup
                        key={group.groupKey}
                        group={group}
                        isMobile={isMobile}
                        maxVisibleCards={activeGroupFilter ? 11 : 3}
                        gridColumns={4}
                        gridGap={8}
                        marginBottom={0}
                        showCardCount={false}
                        compact
                        onShowAll={handleShowAll}
                        onCardClick={handleSynergyCardClick}
                      />
                    ))
                  )}
                </section>

                {/* Compare-card — destination of the FLIP animation. Absolutely positioned at the right
                    side of cards-row, occupying 380×530. Only mounted in comparison mode. */}
                {comparisonPair && !isMobile && (
                  <div
                    ref={compareCardRef}
                    aria-hidden="true"
                    style={{
                      position: 'absolute',
                      top: 0,
                      right: 0,
                      width: cardWidth,
                      height: cardHeight,
                      borderRadius: 14,
                      overflow: 'hidden',
                      background: COLORS.background,
                      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
                      transformOrigin: 'top left',
                      zIndex: 5,
                      opacity: highlightedCard === 'a' ? 0.4 : 1,
                      filter:
                        highlightedCard === 'b'
                          ? 'drop-shadow(0 0 8px rgba(212, 175, 55, 0.6))'
                          : undefined,
                      transition:
                        'opacity 0.2s ease, filter 0.2s ease',
                    }}>
                    {comparisonPair.cardB.imageUrl && (
                      <img
                        src={comparisonPair.cardB.imageUrl}
                        alt={comparisonPair.cardB.fullName}
                        style={{
                          width: '100%',
                          height: '100%',
                          display: 'block',
                          objectFit: 'cover',
                        }}
                      />
                    )}
                  </div>
                )}

                {/* Pair connector — single gold dashed line between cards (mockup phase 2).
                    The score readout lives in the engine column; the connector is just the visual link. */}
                {comparisonPair && !isMobile && <PairConnector cardHeight={cardHeight} />}
              </div>

              {/* Comparison-detail panel — animated max-height grow + opacity fade.
                  Holds the engine + community columns (rule explanations, votes, metrics). */}
              <div
                aria-hidden={!inComparison}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 14,
                  maxHeight: inComparison ? 1500 : 0,
                  opacity: inComparison ? 1 : 0,
                  overflow: 'hidden',
                  flexShrink: 0,
                  transition:
                    'max-height 480ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 300ms ease-out 250ms',
                }}>
                {comparisonPair && (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                      gap: 20,
                      alignItems: 'flex-start',
                    }}>
                    <EngineColumn
                      pair={comparisonPair}
                      engineScore={comparisonPair.aggregateScore}
                      onHighlight={setHighlightedCard}
                    />
                    <CommunityColumn
                      pair={comparisonPair}
                      engineScore={comparisonPair.aggregateScore}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </>
    </RenderProfiler>
  );
}

// ── Subcomponents ──

interface PairConnectorProps {
  cardHeight: number;
}

/**
 * Pair connector — single gold dashed line between the two cards (mockup phase 2).
 *
 * The line spans the full info-col gap and reveals from center outward (clip-path inset(0 50% 0 50%)
 * → inset(0)) over 1s with a 200ms delay. Tier color and score were dropped here because the engine
 * column carries the score readout; this connector is purely a visual "these are paired" cue.
 */
function PairConnector({cardHeight}: PairConnectorProps) {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        top: cardHeight / 2,
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 192,
        zIndex: 6,
        animation: 'card-overview-connector-in 250ms ease-out 200ms both',
      }}>
      <span
        style={{
          display: 'block',
          width: '100%',
          height: 2,
          backgroundImage: `repeating-linear-gradient(to right, ${COLORS.primary500} 0, ${COLORS.primary500} 6px, transparent 6px, transparent 12px)`,
          backgroundSize: '12px 2px',
          opacity: 0.7,
          animation:
            'card-overview-connector-line-center 1000ms cubic-bezier(0.2, 0.8, 0.2, 1) 200ms both',
        }}
      />
    </div>
  );
}

/**
 * Close (×) button — circular, gold-accent on hover.
 * Matches mockup `.close-btn:hover { color: var(--text); border-color: var(--muted); background: var(--surface-alt) }`.
 */
function CloseButton({onClose}: {onClose: () => void}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      aria-label="Close"
      onClick={onClose}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 28,
        height: 28,
        padding: 0,
        borderRadius: '50%',
        background: hovered ? COLORS.surfaceAlt : 'transparent',
        border: `1px solid ${hovered ? COLORS.textMuted : COLORS.surfaceBorder}`,
        color: hovered ? COLORS.text : COLORS.textMuted,
        fontSize: 18,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        fontFamily: 'Arial, sans-serif',
        transition: 'color 0.15s ease, border-color 0.15s ease, background 0.15s ease',
      }}>
      ×
    </button>
  );
}

/**
 * BACK button (focused-state nav) — gold-bordered chip.
 * Matches mockup `.compare-back:hover { background: rgba(212,175,55,0.2); color: var(--gold-bright) }`.
 */
function BackButton({onClick}: {onClick: () => void}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      aria-label="Back to synergies"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        background: hovered ? 'rgba(212, 175, 55, 0.2)' : 'rgba(212, 175, 55, 0.1)',
        border: `1px solid ${COLORS.primary500}`,
        color: hovered ? COLORS.primary : COLORS.primary500,
        fontFamily: 'inherit',
        fontSize: 12,
        fontWeight: 700,
        padding: '7px 14px',
        borderRadius: 18,
        cursor: 'pointer',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        flexShrink: 0,
        transition: 'background 0.15s ease, color 0.15s ease',
      }}>
      <span aria-hidden="true">←</span>
      <span>Back</span>
    </button>
  );
}
