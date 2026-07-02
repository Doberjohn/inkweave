import {describe, it, expect, vi, beforeEach} from 'vitest';
import {trackCardSelected} from '../cardAnalytics';
import {trackEvent} from '../../../../shared/lib/analytics';
import {createCard} from '../../../../shared/test-utils';

vi.mock('../../../../shared/lib/analytics', () => ({
  trackEvent: vi.fn(),
}));

describe('trackCardSelected', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('emits card_selected with the card fields and source', () => {
    const card = createCard({
      id: '13001',
      fullName: 'Elsa - Snow Queen',
      ink: 'Amber',
      type: 'Character',
    });

    trackCardSelected(card, 'browse');

    expect(trackEvent).toHaveBeenCalledWith('card_selected', {
      cardId: '13001',
      cardName: 'Elsa - Snow Queen',
      source: 'browse',
      ink: 'Amber',
      type: 'Character',
    });
  });

  it('no-ops when the card cannot be resolved', () => {
    trackCardSelected(undefined, 'home');

    expect(trackEvent).not.toHaveBeenCalled();
  });
});
