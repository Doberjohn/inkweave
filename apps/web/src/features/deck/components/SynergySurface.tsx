import {CAP_LABEL, CAP_LABEL_XS, COLORS, FONT_SIZES, FONTS, RADIUS, SPACING, SURFACE_CARD, TABULAR} from '../../../shared/constants';
import type {LorcanaCard} from '../types';
import type {DeckSynergyResult} from '../analysis/deckSynergy';
import {smallImageUrl} from '../../cards/loader';

interface SynergySurfaceProps {
  synergy: DeckSynergyResult;
  getCardById: (id: string) => LorcanaCard | undefined;
}

/** One row in a key-cards / weak-links list: thumbnail, name, connection count. */
function SynergyCardChip({card, connections}: {card: LorcanaCard; connections: number}) {
  const name = card.fullName || card.name || 'Unknown card';
  return (
    <div style={{display: 'flex', alignItems: 'center', gap: SPACING.sm}}>
      <div style={{width: 40, height: 18, borderRadius: RADIUS.xs, overflow: 'hidden', flexShrink: 0, border: `1px solid ${COLORS.surfaceBorder}`}}>
        <img src={smallImageUrl(card)} alt="" style={{width: '100%', height: '100%', objectFit: 'cover', objectPosition: '58% 4%'}} />
      </div>
      <span
        style={{
          flex: 1,
          minWidth: 0,
          color: COLORS.text,
          fontFamily: FONTS.body,
          fontSize: `${FONT_SIZES.base}px`,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
        {name}
      </span>
      <span style={{flexShrink: 0, color: COLORS.textMuted, fontFamily: FONTS.body, fontSize: `${FONT_SIZES.sm}px`, ...TABULAR}}>
        {connections} {connections === 1 ? 'link' : 'links'}
      </span>
    </div>
  );
}

/** A titled list of card chips; renders nothing when it resolves to no cards. */
function CardList({
  title,
  ids,
  connectionCounts,
  getCardById,
}: {
  title: string;
  ids: string[];
  connectionCounts: Record<string, number>;
  getCardById: (id: string) => LorcanaCard | undefined;
}) {
  const cards = ids.map((id) => getCardById(id)).filter((c): c is LorcanaCard => c != null);
  if (cards.length === 0) return null;
  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: SPACING.xs}}>
      <div style={CAP_LABEL_XS}>{title}</div>
      {cards.map((card) => (
        <SynergyCardChip key={card.id} card={card} connections={connectionCounts[card.id] ?? 0} />
      ))}
    </div>
  );
}

/**
 * The deck's synergy shape (#471): key cards (the hubs holding the deck together)
 * and weak links (low-connection cut candidates), resolved from aggregateDeckSynergy.
 * The overall density also feeds the health grid; this surface is the actionable
 * "what's anchoring / what's adrift" list.
 */
export function SynergySurface({synergy, getCardById}: SynergySurfaceProps) {
  const hasContent = synergy.keyCards.length > 0 || synergy.weakLinks.length > 0;
  return (
    <div style={{...SURFACE_CARD, display: 'flex', flexDirection: 'column', gap: SPACING.md}}>
      <div style={{display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: SPACING.sm}}>
        <div style={CAP_LABEL}>Synergy</div>
        <span style={{color: COLORS.textMuted, fontFamily: FONTS.body, fontSize: `${FONT_SIZES.sm}px`, ...TABULAR}}>
          {synergy.overallScore} / 100 density
        </span>
      </div>
      {hasContent ? (
        <>
          <CardList title="Key cards" ids={synergy.keyCards} connectionCounts={synergy.connectionCounts} getCardById={getCardById} />
          <CardList title="Weak links" ids={synergy.weakLinks} connectionCounts={synergy.connectionCounts} getCardById={getCardById} />
        </>
      ) : (
        <span style={{color: COLORS.textMuted, fontFamily: FONTS.body, fontSize: `${FONT_SIZES.sm}px`}}>
          No standout synergy hubs yet — add cards that share mechanics.
        </span>
      )}
    </div>
  );
}
