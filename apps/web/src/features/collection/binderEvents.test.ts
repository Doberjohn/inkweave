import {beforeEach, describe, expect, it, vi} from 'vitest';
import {trackEvent} from '../../shared/lib/analytics';
import {trackHandCount, trackViewPick, trackedPicks} from './binderEvents';

vi.mock('../../shared/lib/analytics', () => ({trackEvent: vi.fn()}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('trackHandCount', () => {
  const POCKET = {surface: 'pocket', mode: 'binder'} as const;

  it('counts a first copy of a card held in neither finish as a new card', () => {
    trackHandCount({cardId: 'nani', finish: 'normal', count: 1, before: {normal: 0, foil: 0}}, POCKET);
    expect(trackEvent).toHaveBeenCalledExactlyOnceWith('collection_copies_changed', {
      surface: 'pocket',
      mode: 'binder',
      finish: 'normal',
      change: 'add',
      newCard: true,
    });
  });

  it('counts a copy added in a finish the card lacks, held in the other, as no new card', () => {
    trackHandCount({cardId: 'nani', finish: 'foil', count: 1, before: {normal: 2, foil: 0}}, POCKET);
    expect(trackEvent).toHaveBeenCalledWith('collection_copies_changed', expect.objectContaining({change: 'add', newCard: false}));
  });

  it('counts a copy taken away as a remove, and passes its place through, never the card', () => {
    trackHandCount(
      {cardId: 'nani', finish: 'normal', count: 1, before: {normal: 2, foil: 0}},
      {surface: 'window', mode: 'friend_binder'},
    );
    expect(trackEvent).toHaveBeenCalledExactlyOnceWith('collection_copies_changed', {
      surface: 'window',
      mode: 'friend_binder',
      finish: 'normal',
      change: 'remove',
      newCard: false,
    });
    expect(JSON.stringify(vi.mocked(trackEvent).mock.calls)).not.toContain('nani');
  });
});

describe('trackViewPick', () => {
  it('sends the control, the value picked and whether the binder is a friend’s', () => {
    trackViewPick('set', {value: '13', was: 'all'}, true);
    expect(trackEvent).toHaveBeenCalledExactlyOnceWith('binder_view_changed', {control: 'set', value: '13', friend: true});
  });

  it('sends nothing for a pick of what is on show', () => {
    trackViewPick('show', {value: 'owned', was: 'owned'}, false);
    expect(trackEvent).not.toHaveBeenCalled();
  });
});

describe('trackedPicks', () => {
  const NOW = {setCode: 'all', show: 'all', axis: 'complete', friend: false} as const;

  it('sends each pick as its control, then makes the pick it wraps', () => {
    const picks = {onSetChange: vi.fn(), onShowChange: vi.fn(), onAxisChange: vi.fn()};
    const tracked = trackedPicks(picks, NOW);

    tracked.onSetChange('P2');
    tracked.onShowChange('missing');
    tracked.onAxisChange('master');

    expect(vi.mocked(trackEvent).mock.calls).toEqual([
      ['binder_view_changed', {control: 'set', value: 'P2', friend: false}],
      ['binder_view_changed', {control: 'show', value: 'missing', friend: false}],
      ['binder_view_changed', {control: 'axis', value: 'master', friend: false}],
    ]);
    expect(picks.onSetChange).toHaveBeenCalledWith('P2');
    expect(picks.onShowChange).toHaveBeenCalledWith('missing');
    expect(picks.onAxisChange).toHaveBeenCalledWith('master');
  });

  it('still makes a pick of what is on show, sending nothing for it', () => {
    const picks = {onSetChange: vi.fn(), onShowChange: vi.fn(), onAxisChange: vi.fn()};
    trackedPicks(picks, NOW).onShowChange('all');

    expect(picks.onShowChange).toHaveBeenCalledWith('all');
    expect(trackEvent).not.toHaveBeenCalled();
  });
});
