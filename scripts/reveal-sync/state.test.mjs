import {describe, it, expect} from 'vitest';
import {
  markVanished,
  recordOutcome,
  selectCandidates,
  serializeState,
  setSection,
  shrinkWarning,
  waitingDays,
} from './state.mjs';

const section = (cards) => ({cards});

describe('selectCandidates', () => {
  it('returns cards never seen, plus deferred and conflicted ones to retry', () => {
    const s = section({
      written: {status: 'written', firstSeen: '2026-09-24'},
      waiting: {status: 'deferred', reason: 'scan-not-english', firstSeen: '2026-09-24'},
      disputed: {status: 'conflict', reason: 'needs-reserved-band', firstSeen: '2026-09-24'},
      dropped: {status: 'skipped', reason: 'rarity-excluded', firstSeen: '2026-09-24'},
    });
    expect(selectCandidates(['written', 'waiting', 'disputed', 'dropped', 'brand-new'], s)).toEqual(
      ['waiting', 'disputed', 'brand-new'],
    );
  });
});

describe('selectCandidates after a slug came back', () => {
  it('fetches a retired slug again once it reappears on the site, so a truncated index loses nothing', () => {
    const s = section({'on-the-open-road': {status: 'gone', firstSeen: '2026-09-24'}});
    expect(selectCandidates(['on-the-open-road'], s)).toEqual(['on-the-open-road']);
    expect(selectCandidates([], s)).toEqual([]);
  });
});

describe('shrinkWarning', () => {
  it('warns when the site lists fewer cards than last run, and is silent otherwise', () => {
    expect(shrinkWarning({indexTotal: 81}, 60)).toMatch(/21 fewer than the last run's 81/);
    expect(shrinkWarning({indexTotal: 81}, 90)).toBeNull();
    expect(shrinkWarning({}, 60)).toBeNull();
  });
});

describe('markVanished', () => {
  it('retires a waiting card whose slug left the site, so it stops showing as waiting', () => {
    // A Japanese reveal's translated name is often replaced once the English card appears,
    // which changes its slug. The old entry must not wait forever.
    const s = section({
      'bellwether-super-capable': {
        number: 159,
        status: 'deferred',
        reason: 'scan-not-english',
        firstSeen: '2026-09-24',
      },
      'ernesto-de-la-cruz-idol-of-millions': {
        number: 118,
        status: 'written',
        firstSeen: '2026-09-24',
      },
    });
    expect(markVanished(['bellwether-exceptionally-capable'], s)).toEqual([
      'bellwether-super-capable',
    ]);
    expect(s.cards['bellwether-super-capable']).toMatchObject({status: 'gone'});
    expect(s.cards['ernesto-de-la-cruz-idol-of-millions'].status).toBe('written');
  });
});

describe('recordOutcome', () => {
  it('keeps the first-seen date across runs so waiting time accumulates', () => {
    const s = section({});
    recordOutcome(
      s,
      'on-the-open-road',
      {status: 'deferred', reason: 'scan-not-english', detail: 'JA', number: 27},
      '2026-09-24',
    );
    recordOutcome(
      s,
      'on-the-open-road',
      {status: 'deferred', reason: 'scan-not-english', detail: 'JA', number: 27},
      '2026-09-27',
    );
    expect(s.cards['on-the-open-road']).toEqual({
      number: 27,
      status: 'deferred',
      reason: 'scan-not-english',
      detail: 'JA',
      firstSeen: '2026-09-24',
    });
  });

  it('drops a stale reason once the card is written', () => {
    const s = section({});
    recordOutcome(
      s,
      'x',
      {status: 'deferred', reason: 'scan-not-english', number: 27},
      '2026-09-24',
    );
    recordOutcome(s, 'x', {status: 'written', number: 27}, '2026-09-26');
    expect(s.cards.x).toEqual({number: 27, status: 'written', firstSeen: '2026-09-24'});
  });

  it('keeps a known collector number when a later outcome has none', () => {
    const s = section({x: {number: 27, status: 'deferred', firstSeen: '2026-09-24'}});
    recordOutcome(s, 'x', {status: 'deferred', reason: 'site-record-incomplete'}, '2026-09-25');
    expect(s.cards.x.number).toBe(27);
  });
});

describe('waitingDays', () => {
  it('counts whole days since the card was first seen', () => {
    expect(waitingDays({firstSeen: '2026-09-24'}, '2026-09-27')).toBe(3);
    expect(waitingDays({firstSeen: '2026-09-24'}, '2026-09-24')).toBe(0);
  });
});

describe('state file', () => {
  it('keeps each set in its own section so a season rotation starts clean', () => {
    const state = {sets: {}};
    setSection(state, '14').cards.a = {status: 'written', firstSeen: '2026-09-24'};
    expect(setSection(state, '15').cards).toEqual({});
    expect(setSection(state, '14').cards.a.status).toBe('written');
  });

  it('serializes with sorted slugs so each run produces a minimal diff', () => {
    const state = {sets: {14: {cards: {zeta: {status: 'written'}, alpha: {status: 'written'}}}}};
    const text = serializeState(state);
    expect(text.indexOf('alpha')).toBeLessThan(text.indexOf('zeta'));
    expect(text.endsWith('\n')).toBe(true);
  });
});
