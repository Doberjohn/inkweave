import {useEffect} from 'react';
import {createPortal} from 'react-dom';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {CardGrid} from '../cards/components/CardGrid';
import {FONTS, INK_COLORS, Z_INDEX} from '../../shared/constants';
import {useScrollLock} from '../../shared/hooks';
import type {FranchiseConfig} from './franchise';
import {inkRgba} from './inkTint';

interface FranchiseCardsModalProps {
  franchise: FranchiseConfig;
  /** The revealed cards belonging to this franchise. */
  cards: LorcanaCard[];
  onClose: () => void;
  /** Opens a card's detail (the shared card modal) on top of this one. */
  onCardClick: (card: LorcanaCard) => void;
}

/**
 * A focused overlay listing one franchise's revealed cards in a grid. Replaces
 * the old Tracker/Franchises toggle: a click on a franchise card opens this.
 * Dismiss via backdrop click or Escape. Sits one z-index below the shared
 * card-detail modal's backdrop so clicking a card layers its detail cleanly on
 * top while this stays behind. Portals to body to escape stacking contexts.
 */
export function FranchiseCardsModal({franchise, cards, onClose, onCardClick}: FranchiseCardsModalProps) {
  useScrollLock(true);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const inkText = INK_COLORS[franchise.ink].text;

  return createPortal(
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- backdrop dismiss; Escape handled via document listener
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${franchise.label} cards`}
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: Z_INDEX.modalBackdrop - 1,
        background: 'rgba(0, 0, 0, 0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- click boundary so panel clicks don't dismiss */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 960,
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          background: '#12121f',
          border: `1px solid ${inkRgba(franchise.ink, 0.4)}`,
          borderRadius: 16,
          overflow: 'hidden',
          boxShadow: `0 24px 80px rgba(0, 0, 0, 0.6), 0 0 40px ${inkRgba(franchise.ink, 0.12)}`,
        }}
      >
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            padding: '18px 22px',
            borderBottom: '1px solid #24243a',
            backgroundImage: `radial-gradient(420px 120px at 0% 0%, ${inkRgba(franchise.ink, 0.16)}, transparent)`,
          }}
        >
          <div>
            <div style={{fontWeight: 600, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: inkText}}>
              New this set
            </div>
            <h2 style={{fontFamily: FONTS.hero, fontWeight: 700, fontSize: 24, color: '#f0f0f5', margin: '4px 0 0'}}>
              {franchise.label}
            </h2>
          </div>
          <div style={{display: 'flex', alignItems: 'center', gap: 14}}>
            <span style={{fontWeight: 600, fontSize: 13, color: '#90a1b9'}}>
              {cards.length} card{cards.length === 1 ? '' : 's'}
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              style={{
                appearance: 'none',
                cursor: 'pointer',
                width: 34,
                height: 34,
                borderRadius: 8,
                border: '1px solid #2a2a40',
                background: 'rgba(255, 255, 255, 0.03)',
                color: '#cfd3df',
                fontSize: 18,
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>
        </header>

        <div style={{overflowY: 'auto', padding: '16px 18px 22px'}}>
          <CardGrid
            cards={cards}
            onSelect={onCardClick}
            emptyMessage="No cards revealed yet for this franchise."
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}
