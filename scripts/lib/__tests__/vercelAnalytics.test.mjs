import {describe, it, expect} from 'vitest';
import {
  eventNameFilter,
  eventDataDimension,
  breakdownDimension,
  breakdownValueKey,
  reportingWindow,
  buildEvent,
  buildVercelAnalytics,
  emptyVercelAnalytics,
  EVENT_QUERIES,
} from '../vercelAnalytics.mjs';

describe('eventNameFilter', () => {
  it('builds an OData equality filter', () => {
    expect(eventNameFilter('vote_submitted')).toBe("eventName eq 'vote_submitted'");
  });

  it('doubles single quotes in the event name', () => {
    expect(eventNameFilter("o'brien")).toBe("eventName eq 'o''brien'");
  });
});

describe('eventDataDimension', () => {
  it('leaves identifier-safe props bare', () => {
    expect(eventDataDimension('voteType')).toBe('eventData/voteType');
    expect(eventDataDimension('clickedCardInk')).toBe('eventData/clickedCardInk');
  });

  it('single-quotes props with non-identifier characters', () => {
    expect(eventDataDimension('signup-source')).toBe("eventData/'signup-source'");
  });
});

describe('breakdownDimension / breakdownValueKey', () => {
  it('routes eventData breakdowns through eventData/<prop>', () => {
    const bd = {prop: 'voteType', label: 'By vote type'};
    expect(breakdownDimension(bd)).toBe('eventData/voteType');
    expect(breakdownValueKey(bd)).toBe('eventData');
  });

  it('routes automatic dimensions to a bare `by` and reads the value under the dimension key', () => {
    const bd = {prop: 'deviceType', label: 'By device', source: 'dimension'};
    expect(breakdownDimension(bd)).toBe('deviceType');
    expect(breakdownValueKey(bd)).toBe('deviceType');
  });
});

describe('buildEvent breakdowns', () => {
  it('reads dimension values from the dimension-named key', () => {
    const ev = buildEvent({
      name: 'search_submitted',
      label: 'Searches',
      breakdowns: [
        {
          prop: 'deviceType',
          label: 'By device',
          valueKey: 'deviceType',
          rows: [{deviceType: 'mobile', count: 40, visitors: 30}],
        },
      ],
    });
    expect(ev.breakdowns[0].rows[0]).toEqual({value: 'mobile', count: 40, visitors: 30});
  });

  it('sorts numeric breakdowns ascending by value, non-numeric last', () => {
    const ev = buildEvent({
      name: 'vote_submitted',
      label: 'Votes submitted',
      breakdowns: [
        {
          prop: 'engineScore',
          label: 'By engine score',
          valueKey: 'eventData',
          numeric: true,
          rows: [
            {eventData: '9', count: 5},
            {eventData: 'Others', count: 2},
            {eventData: '4', count: 20},
            {eventData: '7', count: 12},
          ],
        },
      ],
    });
    expect(ev.breakdowns[0].rows.map((r) => r.value)).toEqual(['4', '7', '9', 'Others']);
  });
});

describe('EVENT_QUERIES expansion', () => {
  it('carries numeric score distributions and the device dimension on votes', () => {
    const votes = EVENT_QUERIES.find((q) => q.name === 'vote_submitted');
    expect(votes.breakdowns.some((b) => b.prop === 'engineScore' && b.numeric)).toBe(true);
    expect(votes.breakdowns.some((b) => b.prop === 'deviceType' && b.source === 'dimension')).toBe(true);
  });
});

describe('reportingWindow', () => {
  it('returns YYYY-MM-DD bounds `days` apart', () => {
    const ref = new Date('2026-07-03T12:00:00.000Z');
    expect(reportingWindow(ref, 30)).toEqual({since: '2026-06-03', until: '2026-07-03'});
  });
});

describe('buildEvent', () => {
  it('maps raw API responses into the event shape', () => {
    const ev = buildEvent({
      name: 'vote_submitted',
      label: 'Votes submitted',
      count: {count: 412, visitors: 300},
      trend: [{timestamp: '2026-07-01T00:00:00.000Z', count: 22}],
      breakdowns: [
        {
          prop: 'voteType',
          label: 'By vote type',
          rows: [{eventData: 'quick', count: 250, visitors: 190}],
        },
      ],
    });
    expect(ev.total).toBe(412);
    expect(ev.visitors).toBe(300);
    expect(ev.trend[0]).toEqual({date: '2026-07-01', count: 22});
    expect(ev.breakdowns[0].rows[0]).toEqual({value: 'quick', count: 250, visitors: 190});
  });

  it('defaults missing fields to zero without throwing', () => {
    const ev = buildEvent({name: 'vote_skipped', label: 'Votes skipped'});
    expect(ev.total).toBe(0);
    expect(ev.trend).toEqual([]);
    expect(ev.breakdowns).toEqual([]);
  });
});

describe('buildVercelAnalytics', () => {
  it('flags hasVercelData true when events are present', () => {
    const art = buildVercelAnalytics({
      events: [{name: 'vote_submitted'}],
      window: {since: '2026-06-03', until: '2026-07-03'},
    });
    expect(art.hasVercelData).toBe(true);
    expect(art.reportingWindow.since).toBe('2026-06-03');
    expect(art.events).toHaveLength(1);
  });
});

describe('emptyVercelAnalytics', () => {
  it('is a valid empty artifact', () => {
    expect(emptyVercelAnalytics()).toEqual({hasVercelData: false, reportingWindow: null, events: []});
  });
});

describe('EVENT_QUERIES', () => {
  it('covers all 10 catalog events with stable names', () => {
    expect(EVENT_QUERIES.map((q) => q.name)).toEqual([
      'reveal_card_click',
      'vote_submitted',
      'card_selected',
      'synergy_card_clicked',
      'playstyle_opened',
      'vote_skipped',
      'search_submitted',
      'filter_applied',
      'sort_changed',
      'synergy_group_viewed',
    ]);
  });
});
