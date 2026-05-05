import {useMemo, useRef, useState} from 'react';
import type {LorcanaCard} from '../../cards';
import type {SynergyGroup as SynergyGroupData} from '../types';
import {SynergyGroup} from './SynergyGroup';
import {CardImage, CardLightbox, RenderProfiler} from '../../../shared/components';
import {useDialogFocus} from '../../../shared/hooks/useDialogFocus';
import {useScrollLock, useTransitionPresence} from '../../../shared/hooks';
import {getDominantScore, getStrengthTier} from '../utils';
import {COLORS, FONTS, RADIUS, Z_INDEX} from '../../../shared/constants';

interface CardOverviewModalProps {
  isOpen: boolean;
  card: LorcanaCard;
  synergies: SynergyGroupData[];
  onClose: () => void;
  onSynergyCardClick: (clickedCard: LorcanaCard, groupKey?: string) => void;
  isMobile?: boolean;
}

/**
 * Card overview modal — replaces the full-page card detail view with a modal-on-top-of-current-page experience.
 *
 * Layout (matches `apps/web/public/mockups/card-modal-base.html`):
 * - Header: card name (h1) + close button
 * - Chip row: synergy group filters with count badges (tier-colored)
 * - Hero divider (gold gradient line)
 * - Cards row: big card image (left) + group stack (right)
 *
 * State:
 * - default — chip-row inactive, all groups visible with preview-sized mini-grid (3 cards + "+N more" tile)
 * - focused — chip pressed → only that group is visible, with expanded mini-grid (up to 11 cards + More tile)
 *
 * Mini-tile clicks bubble up to `onSynergyCardClick(card, groupKey)`; the parent owns the inner SynergyDetailModal.
 */
export function CardOverviewModal({
  isOpen,
  card,
  synergies,
  onClose,
  onSynergyCardClick,
  isMobile = false,
}: CardOverviewModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const initialFocusRef = useRef<HTMLElement>(null);
  const {mounted, visible, onTransitionEnd} = useTransitionPresence(isOpen);
  useScrollLock(isOpen);

  const {handleKeyDown} = useDialogFocus({
    isOpen,
    containerRef: modalRef,
    initialFocusRef,
    onClose,
  });

  const [activeGroupFilter, setActiveGroupFilter] = useState<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  // Render the engine-supplied tagline (short headline) in place of the long description.
  // For direct rules tagline === description (already a one-liner); playstyles have their
  // own short-form tagline field.
  const visibleGroups = useMemo(() => {
    const base = activeGroupFilter
      ? synergies.filter((g) => g.groupKey === activeGroupFilter)
      : synergies;
    return base.map((g) => ({...g, description: g.tagline}));
  }, [synergies, activeGroupFilter]);

  if (!mounted) return null;

  // 1:1 with mockup: 380×530 card art, 530px-tall cards-row, info-col scrolls inside that height.
  const cardWidth = isMobile ? 240 : 380;
  const cardHeight = Math.round((cardWidth * 368) / 264);

  const toggleChip = (key: string) => {
    setActiveGroupFilter((prev) => (prev === key ? null : key));
  };

  // "+N more" tile click → focus on that group (same end state as clicking the chip)
  const handleShowAll = (groupKey: string) => setActiveGroupFilter(groupKey);

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
            onKeyDown={handleKeyDown}
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

            {/* Chip row */}
            {synergies.length > 0 && (
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

            {/* Hero divider — hidden in empty state (no chip row above it, nothing to separate) */}
            {synergies.length > 0 && (
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

            {/* Modal body — flex column so cards-row sits above future comparison-detail. 1:1 with mockup `.modal-body { padding: 20px 24px 24px; gap: 16px }`. Mobile: whole body scrolls. Desktop: only info-col scrolls. */}
            <div
              style={{
                flex: 1,
                minHeight: 0,
                padding: '20px 24px 24px',
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
                overflowY: isMobile ? 'auto' : 'hidden',
              }}>
              {/* Cards row — fixed 530px height (mockup `.cards-row { height: 530px }`). Cards stay put; info-col scrolls inside. Mobile stacks vertically and grows naturally. */}
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
                }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: isMobile ? 'center' : 'flex-start',
                  alignItems: 'flex-start',
                  flexShrink: 0,
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

              <section
                aria-label="Synergies"
                style={{
                  minWidth: 0,
                  minHeight: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  // 1:1 with mockup `.info-col { gap: 18px; max-height: 530px; padding: 0 14px }` — info-col scrolls inside the cards-row height
                  gap: 18,
                  maxHeight: isMobile ? undefined : cardHeight,
                  overflowY: isMobile ? 'visible' : 'auto',
                  padding: isMobile ? 0 : '0 14px',
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
                      compactMoreTile
                      onShowAll={handleShowAll}
                      onCardClick={onSynergyCardClick}
                    />
                  ))
                )}
              </section>
              </div>
            </div>
          </div>
        </div>
      </>
    </RenderProfiler>
  );
}
