import {CAP_LABEL, COLORS, FONTS, FONT_SIZES, RADIUS, SPACING, SURFACE_CARD} from '../../../shared/constants';
import {CtaButton} from '../../../shared/components';
import {smallImageUrl} from '../../cards/loader';
import type {LorcanaCard, Suggestion} from '../types';
import {describeReason} from './describeReason';

interface SuggestionListProps {
  /** Ranked suggestions from the advisor (already capped in the pipeline). */
  suggestions: Suggestion[];
  getCardById: (id: string) => LorcanaCard | undefined;
  /** Adds a copy of the suggested card to the deck. */
  onAdd: (cardId: string) => void;
  /** How many to show (default 4). */
  limit?: number;
}

interface ResolvedSuggestion {
  card: LorcanaCard;
  reason: string;
}

/** One add-row: thumbnail, name, plain reason, Add button. */
function SuggestionRow({card, reason, onAdd}: {card: LorcanaCard; reason: string; onAdd: () => void}) {
  const name = card.fullName || card.name || 'Unknown card';
  return (
    <div style={{display: 'flex', alignItems: 'center', gap: SPACING.sm}}>
      <div style={{width: 46, height: 21, borderRadius: RADIUS.sm, overflow: 'hidden', flexShrink: 0, border: `1px solid ${COLORS.surfaceBorder}`}}>
        <img src={smallImageUrl(card)} alt="" style={{width: '100%', height: '100%', objectFit: 'cover', objectPosition: '58% 4%'}} />
      </div>
      <div style={{flex: 1, minWidth: 0}}>
        <div style={{color: COLORS.text, fontFamily: FONTS.body, fontSize: `${FONT_SIZES.base}px`, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
          {name}
        </div>
        <div style={{color: COLORS.textMuted, fontFamily: FONTS.body, fontSize: `${FONT_SIZES.sm}px`, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
          {reason}
        </div>
      </div>
      <CtaButton onClick={onAdd} aria-label={`Add ${name}`} style={{minHeight: 34, padding: `0 ${SPACING.md}px`, flexShrink: 0, fontSize: FONT_SIZES.md}}>
        Add
      </CtaButton>
    </div>
  );
}

/**
 * Zone 2 of the Analysis tab (#471): the ranked "add these cards" list — the tab's
 * primary, most-actionable content. Each row carries a plain-English reason
 * (describeReason) and an Add button. Resolves each suggestion's card via
 * getCardById; unresolved ids (rotated out of Core) are dropped. Shows an
 * invitation when the deck is too small to suggest against.
 */
export function SuggestionList({suggestions, getCardById, onAdd, limit = 4}: SuggestionListProps) {
  const resolved: ResolvedSuggestion[] = suggestions
    .slice(0, limit)
    .map((s) => ({card: getCardById(s.cardId), reason: describeReason(s.reasons[0] ?? 'Strengthens your deck')}))
    .filter((r): r is ResolvedSuggestion => r.card != null);

  return (
    <div style={{...SURFACE_CARD, display: 'flex', flexDirection: 'column', gap: SPACING.md}}>
      <div style={CAP_LABEL}>Add these to improve your deck</div>
      {resolved.length === 0 ? (
        <div style={{color: COLORS.textMuted, fontFamily: FONTS.body, fontSize: `${FONT_SIZES.sm}px`}}>
          Add a few more cards and suggestions will appear here.
        </div>
      ) : (
        resolved.map((r) => <SuggestionRow key={r.card.id} card={r.card} reason={r.reason} onAdd={() => onAdd(r.card.id)} />)
      )}
    </div>
  );
}
