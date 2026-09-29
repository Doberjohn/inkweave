import {describe, it, expect} from 'vitest';
import {decide, issueBody, measureDrift, parseStamp} from './deploy-drift.mjs';

/**
 * Master's first-parent chain, newest first: M3 merged a PR whose branch commit F1 was
 * written days before the merge. Production serves M1 in most cases below.
 */
const history = new Map([
  ['M3', {parents: ['M2', 'F1'], date: '2026-09-30T10:00:00Z'}],
  ['F1', {parents: ['M1'], date: '2026-09-25T09:00:00Z'}],
  ['M2', {parents: ['M1'], date: '2026-09-30T08:00:00Z'}],
  ['M1', {parents: ['M0'], date: '2026-09-29T20:00:00Z'}],
]);

describe('measureDrift', () => {
  it('is in sync when production serves master', () => {
    expect(measureDrift(history, 'M3', 'M3')).toEqual({behind: 0, since: null, found: true});
  });

  it('dates the drift from the oldest undeployed master commit, not the newest', () => {
    // Timing it from master's newest commit (M3) would restart the clock on every merge,
    // which is how a two-month outage went unnoticed. The side-branch commit F1 is days
    // old but never counts: it only reached master with M3.
    expect(measureDrift(history, 'M3', 'M1')).toEqual({
      behind: 2,
      since: '2026-09-30T08:00:00Z',
      found: true,
    });
  });

  it('walks past [skip ci] commits without counting them or starting the clock', () => {
    // The reveal-image bot's AVIF commits never start a Deploy run, so production cannot
    // be expected to serve them. Counting them would raise false alarms.
    const withBot = new Map([
      ...history,
      ['B1', {parents: ['M3'], date: '2026-09-30T11:00:00Z', skipsDeploy: true}],
    ]);
    expect(measureDrift(withBot, 'B1', 'M3')).toEqual({behind: 0, since: null, found: true});
    expect(measureDrift(withBot, 'B1', 'M1')).toEqual({
      behind: 2,
      since: '2026-09-30T08:00:00Z',
      found: true,
    });
  });

  it('reports a deployed commit that is not on the walked chain as not found', () => {
    expect(measureDrift(history, 'M3', 'X9')).toEqual({
      behind: 3,
      since: '2026-09-29T20:00:00Z',
      found: false,
    });
  });
});

describe('decide', () => {
  const now = Date.parse('2026-09-30T12:00:00Z');
  const behindSince = (since) => ({behind: 1, since, found: true});

  it('reports in-sync when production serves master', () => {
    const drift = {behind: 0, since: null, found: true};
    expect(decide({drift, now, thresholdHours: 3})).toBe('in-sync');
  });

  it('stays quiet while the drift is inside the grace period', () => {
    // A normal deploy takes 10-30 minutes; that lag must never alert.
    expect(decide({drift: behindSince('2026-09-30T10:00:00Z'), now, thresholdHours: 3})).toBe(
      'within-grace',
    );
  });

  it('alerts once the drift outlives the grace period', () => {
    expect(decide({drift: behindSince('2026-09-30T08:00:00Z'), now, thresholdHours: 3})).toBe(
      'alert',
    );
  });

  it('alerts at once for a failed deploy, even inside the grace period', () => {
    const drift = behindSince('2026-09-30T11:50:00Z');
    expect(decide({drift, deployFailed: true, now, thresholdHours: 3})).toBe('alert');
  });

  it('stays in sync when a deploy fails but production already serves master', () => {
    // GitHub mails the failed run itself; a "not serving master" issue would be wrong.
    const drift = {behind: 0, since: null, found: true};
    expect(decide({drift, deployFailed: true, now, thresholdHours: 3})).toBe('in-sync');
  });

  it("alerts when production's stamp cannot be read", () => {
    const stampError = 'GET /version.json answered HTTP 404';
    expect(decide({drift: null, stampError, now, thresholdHours: 3})).toBe('alert');
  });

  it("alerts when the deployed commit is not on master's recent chain, however recent", () => {
    const drift = {behind: 300, since: '2026-09-30T11:00:00Z', found: false};
    expect(decide({drift, now, thresholdHours: 3})).toBe('alert');
  });
});

describe('issueBody', () => {
  const base = {
    repo: 'Doberjohn/inkweave',
    prodUrl: 'https://inkweave.ink',
    masterSha: 'b'.repeat(40),
    now: Date.parse('2026-09-30T12:00:00Z'),
    thresholdHours: 3,
    runUrl: 'https://github.com/Doberjohn/inkweave/actions/runs/1',
    failedRunUrl: '',
    simulated: false,
  };

  it('names both commits, the drift age against the grace period, and the failed run', () => {
    const body = issueBody({
      ...base,
      stamp: {sha: 'a'.repeat(40)},
      drift: {behind: 2, since: '2026-09-30T08:00:00Z', found: true},
      failedRunUrl: 'https://github.com/Doberjohn/inkweave/actions/runs/2',
    });
    expect(body).toContain('`aaaaaaaa`');
    expect(body).toContain('`bbbbbbbb`');
    expect(body).toContain('4.0 h ago (grace period: 3 h)');
    expect(body).toContain(
      '**Failed deploy:** https://github.com/Doberjohn/inkweave/actions/runs/2',
    );
  });

  it('explains an unreadable stamp instead of naming a production commit', () => {
    const body = issueBody({
      ...base,
      stamp: {error: 'GET /version.json answered HTTP 404'},
      drift: null,
    });
    expect(body).toContain(
      'its version stamp could not be read: GET /version.json answered HTTP 404',
    );
    expect(body).not.toContain('Behind by');
  });
});

describe('parseStamp', () => {
  it('reads the commit from version.json', () => {
    const sha = 'c'.repeat(40);
    expect(parseStamp(JSON.stringify({sha, builtAt: '2026-09-30T06:00:00Z'}))).toEqual({sha});
  });

  it('never reads an HTML page or a partial sha as a stamp', () => {
    expect(parseStamp('<!doctype html><html></html>')).toEqual({
      error: 'GET /version.json did not answer JSON',
    });
    expect(parseStamp('{"sha":"abc123"}').error).toContain('no full commit sha');
  });
});
