import type {LorcanaCard} from 'inkweave-synergy-engine';
import {trackEvent} from '../../../shared/lib/analytics';

/** Where a card's synergy results were on screen. Must match the catalog's `surface` unions. */
export type SynergySurface = 'modal' | 'card_page';

interface SynergyCardClick {
  sourceCardId: string;
  clicked: LorcanaCard;
  /** The group the partner was clicked in, when the results were grouped. */
  groupKey: string | undefined;
  surface: SynergySurface;
}

/** Fire `synergy_card_clicked` for a partner followed from a card's synergy results. */
export function trackSynergyCardClicked({
  sourceCardId,
  clicked,
  groupKey,
  surface,
}: SynergyCardClick): void {
  trackEvent('synergy_card_clicked', {
    sourceCardId,
    clickedCardId: clicked.id,
    clickedCardName: clicked.fullName,
    clickedCardInk: clicked.ink,
    groupKey: groupKey ?? null,
    surface,
  });
}

interface SynergyGroupView {
  sourceCardId: string;
  groupKey: string;
  action: 'isolate' | 'show_all';
  surface: SynergySurface;
}

/** Fire `synergy_group_viewed` for a group isolated by its chip or expanded by its More tile. */
export function trackSynergyGroupViewed(view: SynergyGroupView): void {
  trackEvent('synergy_group_viewed', view);
}
