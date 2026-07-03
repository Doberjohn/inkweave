import {describe, expect, it} from 'vitest';
import {groupVotesByDay} from '../activityStats';
import type {VoteLogRow} from '../voteLogTypes';

function row(overrides: Partial<VoteLogRow> & Pick<VoteLogRow, 'ts' | 'voter'>): VoteLogRow {
  return {
    a: '1',
    b: '2',
    aName: 'Card A',
    bName: 'Card B',
    score: 5,
    accuracy: null,
    isReal: null,
    wouldPlay: null,
    difficulty: null,
    whoCarries: null,
    ...overrides,
  };
}

describe('groupVotesByDay', () => {
  it('groups votes by calendar day, newest day first', () => {
    const groups = groupVotesByDay([
      row({ts: '2026-07-01T09:00:00Z', voter: 1}),
      row({ts: '2026-07-03T10:00:00Z', voter: 2}),
      row({ts: '2026-07-01T18:00:00Z', voter: 1}),
      row({ts: '2026-07-02T12:00:00Z', voter: 3}),
    ]);
    expect(groups.map((g) => g.day)).toEqual(['2026-07-03', '2026-07-02', '2026-07-01']);
    expect(groups.map((g) => g.count)).toEqual([1, 1, 2]);
  });

  it('counts distinct voter tokens per day', () => {
    const groups = groupVotesByDay([
      row({ts: '2026-07-01T09:00:00Z', voter: 1}),
      row({ts: '2026-07-01T10:00:00Z', voter: 2}),
      row({ts: '2026-07-01T11:00:00Z', voter: 1}),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].count).toBe(3);
    expect(groups[0].voters).toBe(2);
  });

  it('preserves input order of votes within a day', () => {
    const groups = groupVotesByDay([
      row({ts: '2026-07-01T09:00:00Z', voter: 1, aName: 'First'}),
      row({ts: '2026-07-01T08:00:00Z', voter: 2, aName: 'Second'}),
      row({ts: '2026-07-01T20:00:00Z', voter: 3, aName: 'Third'}),
    ]);
    expect(groups[0].votes.map((v) => v.aName)).toEqual(['First', 'Second', 'Third']);
  });

  it('returns [] for empty input', () => {
    expect(groupVotesByDay([])).toEqual([]);
  });
});
