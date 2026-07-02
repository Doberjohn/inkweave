import type {LorcanaCard} from '../types';
import {trackEvent} from '../../../shared/lib/analytics';

/** The discovery surface a card was opened from. Must match the `card_selected` catalog union. */
export type CardSelectSource = 'browse' | 'home' | 'playstyle' | 'playstyle_gallery';

/**
 * Fire `card_selected` for a card opened from a discovery surface. No-ops when the
 * card can't be resolved (e.g. a stale id), so callers can pass `getCardById(id)`
 * directly without a null check at every site.
 */
export function trackCardSelected(card: LorcanaCard | undefined, source: CardSelectSource): void {
  if (!card) return;
  trackEvent('card_selected', {
    cardId: card.id,
    cardName: card.fullName,
    source,
    ink: card.ink,
    type: card.type,
  });
}
