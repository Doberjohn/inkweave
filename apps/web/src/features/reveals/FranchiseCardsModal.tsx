import type {Ink, LorcanaCard} from 'inkweave-synergy-engine';
import {CardGrid} from '../cards/components/CardGrid';
import {COLORS, FONTS, FONT_SIZES, INK_COLORS, SHADOWS} from '../../shared/constants';
import {DialogShell, IconButton} from '../../shared/components';
import {inkRgba} from './inkTint';

interface FranchiseCardsModalProps {
  /** Heading + aria label for the showcase (a franchise name, or "Team Characters"). */
  source: {label: string; ink: Ink};
  /** The revealed cards to list. */
  cards: LorcanaCard[];
  onClose: () => void;
  /** Opens a card's detail (the shared card modal) on top of this one. */
  onCardClick: (card: LorcanaCard) => void;
}

/**
 * A focused overlay listing one Set 13 showcase's revealed cards in a grid — a
 * franchise (Monsters, Inc. / Up / Turning Red) or the Team characters. Rides
 * DialogShell (#510) on the `underModal` layer: one z-index below the shared
 * card-detail modal's backdrop so clicking a card layers its detail cleanly on
 * top while this stays behind.
 */
export function FranchiseCardsModal({source, cards, onClose, onCardClick}: FranchiseCardsModalProps) {
  const inkText = INK_COLORS[source.ink].text;

  return (
    <DialogShell
      isOpen
      onClose={onClose}
      ariaLabel={`${source.label} cards`}
      size="lg"
      layer="underModal"
      panelStyle={{
        display: 'flex',
        flexDirection: 'column',
        background: COLORS.surfaceAlt,
        border: `1px solid ${inkRgba(source.ink, 0.4)}`,
        overflow: 'hidden',
        boxShadow: `${SHADOWS.overlay}, 0 0 40px ${inkRgba(source.ink, 0.12)}`,
      }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          padding: '18px 22px',
          borderBottom: `1px solid ${COLORS.surfaceHover}`,
          backgroundImage: `radial-gradient(420px 120px at 0% 0%, ${inkRgba(source.ink, 0.16)}, transparent)`,
        }}
      >
        <div>
          <div style={{fontWeight: 600, fontSize: FONT_SIZES.xs, letterSpacing: 2, textTransform: 'uppercase', color: inkText}}>
            New this set
          </div>
          <h2 style={{fontFamily: FONTS.hero, fontWeight: 400, fontSize: FONT_SIZES.xxxl, color: COLORS.text, margin: '4px 0 0'}}>
            {source.label}
          </h2>
        </div>
        <div style={{display: 'flex', alignItems: 'center', gap: 14}}>
          <span style={{fontWeight: 600, fontSize: FONT_SIZES.base, color: COLORS.textMuted}}>
            {cards.length} card{cards.length === 1 ? '' : 's'}
          </span>
          <IconButton type="button" onClick={onClose} aria-label="Close" size={34} style={{fontSize: FONT_SIZES.xl}}>
            ×
          </IconButton>
        </div>
      </header>

      <div style={{overflowY: 'auto', padding: '16px 18px 22px'}}>
        <CardGrid cards={cards} onSelect={onCardClick} emptyMessage="No cards revealed yet." />
      </div>
    </DialogShell>
  );
}
