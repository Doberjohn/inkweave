import {describe, it, expect, vi, beforeEach} from 'vitest';
import {trackSynergyCardClicked, trackSynergyGroupViewed} from '../synergyAnalytics';
import {trackEvent} from '../../../../shared/lib/analytics';
import {createCard} from '../../../../shared/test-utils';

vi.mock('../../../../shared/lib/analytics', () => ({
  trackEvent: vi.fn(),
}));

const ANNA = createCard({id: '13002', fullName: 'Anna - Heir to Arendelle', ink: 'Amber'});

describe('synergy analytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends the clicked partner with its group and surface', () => {
    trackSynergyCardClicked({
      sourceCardId: '13001',
      clicked: ANNA,
      groupKey: 'singer',
      surface: 'card_page',
    });

    expect(trackEvent).toHaveBeenCalledWith('synergy_card_clicked', {
      sourceCardId: '13001',
      clickedCardId: '13002',
      clickedCardName: 'Anna - Heir to Arendelle',
      clickedCardInk: 'Amber',
      groupKey: 'singer',
      surface: 'card_page',
    });
  });

  it('sends a null group for a partner clicked outside a group', () => {
    trackSynergyCardClicked({
      sourceCardId: '13001',
      clicked: ANNA,
      groupKey: undefined,
      surface: 'modal',
    });

    expect(trackEvent).toHaveBeenCalledWith(
      'synergy_card_clicked',
      expect.objectContaining({groupKey: null, surface: 'modal'}),
    );
  });

  it('forwards a group view as synergy_group_viewed', () => {
    const view = {
      sourceCardId: '13001',
      groupKey: 'singer',
      action: 'show_all',
      surface: 'modal',
    } as const;

    trackSynergyGroupViewed(view);

    expect(trackEvent).toHaveBeenCalledWith('synergy_group_viewed', view);
  });
});
