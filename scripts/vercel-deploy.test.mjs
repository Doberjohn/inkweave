import {describe, expect, it} from 'vitest';
import {deploy, parseArgs} from './vercel-deploy.mjs';

// The URL shape a real production deploy printed (run 37001759449).
const STAGED = 'https://inkweave-bnxieb59b-johnfanidis-projects.vercel.app';
const OK = {status: 0, stdout: ''};
const FAILED = {status: 1, stdout: ''};

/**
 * A fake Vercel CLI that answers each call from `results` in order and records its args. An
 * unscripted call throws, so no test can pass through an extra call. Sleeps resolve at once.
 */
function harness(...results) {
  const calls = [];
  const lines = [];
  const sleeps = [];
  const vercel = (args, {capture = false} = {}) => {
    if (!results.length) throw new Error(`unscripted vercel call: ${args.join(' ')}`);
    calls.push({args, capture});
    return results.shift();
  };
  const sleep = async (ms) => {
    sleeps.push(ms);
  };
  return {
    calls,
    lines,
    sleeps,
    options: {token: 't', vercel, sleep, log: (line) => lines.push(line)},
  };
}

describe('vercel-deploy', () => {
  describe('production', () => {
    it('deploys once, promoting, when the first try succeeds', async () => {
      const h = harness(OK);
      expect(await deploy('production', h.options)).toBe(0);
      expect(h.calls).toEqual([
        {args: ['deploy', '--prebuilt', '--prod', '--token=t'], capture: false},
      ]);
      expect(h.sleeps).toEqual([]);
    });

    it('retries once, 15 s later and with a warning, after a failed deploy', async () => {
      const h = harness(FAILED, OK);
      expect(await deploy('production', h.options)).toBe(0);
      expect(h.calls).toHaveLength(2);
      expect(h.calls[1]).toEqual(h.calls[0]);
      expect(h.sleeps).toEqual([15_000]);
      expect(h.lines.join('\n')).toMatch(/^::warning::vercel deploy failed/m);
    });

    it("fails with the retry's exit code when the retry fails too", async () => {
      const h = harness(FAILED, {status: 2, stdout: ''});
      expect(await deploy('production', h.options)).toBe(2);
      expect(h.calls).toHaveLength(2);
    });
  });

  describe('staged', () => {
    it('deploys a new, unpromoted deployment, then removes exactly that one', async () => {
      const h = harness({status: 0, stdout: `${STAGED}\n`}, OK);
      expect(await deploy('staged', h.options)).toBe(0);
      expect(h.calls).toEqual([
        {
          args: ['deploy', '--prebuilt', '--prod', '--skip-domain', '--force', '--token=t'],
          capture: true,
        },
        {args: ['remove', STAGED, '--yes', '--token=t'], capture: false},
      ]);
    });

    it('removes only the deployment that the successful retry printed', async () => {
      const abandoned = 'https://inkweave-aaaaaaaaa-johnfanidis-projects.vercel.app';
      const h = harness({status: 1, stdout: abandoned}, {status: 0, stdout: STAGED}, OK);
      expect(await deploy('staged', h.options)).toBe(0);
      expect(h.calls[2].args).toEqual(['remove', STAGED, '--yes', '--token=t']);
    });

    it.each([
      ['a bare project name', 'inkweave'],
      ['empty', ''],
      ['two URLs', `${STAGED}\n${STAGED}`],
      ["another team's URL", 'https://inkweave-bnxieb59b-other-team.vercel.app'],
      ['a URL with a path', `${STAGED}/version.json`],
    ])('removes nothing and fails when stdout is %s', async (_, stdout) => {
      const h = harness({status: 0, stdout});
      expect(await deploy('staged', h.options)).toBe(1);
      expect(h.calls).toHaveLength(1);
      expect(h.lines.join('\n')).toMatch(/^::error::Unexpected deployment URL/m);
    });

    // A failed deploy can still have printed its URL: the CLI writes it once the deployment
    // exists, before the steps that can fail.
    it("removes nothing and fails with the retry's code when both attempts fail", async () => {
      const h = harness({status: 1, stdout: STAGED}, {status: 2, stdout: STAGED});
      expect(await deploy('staged', h.options)).toBe(2);
      expect(h.calls.map((call) => call.args[0])).toEqual(['deploy', 'deploy']);
    });

    it('fails, naming the deployment to delete by hand, when the remove fails', async () => {
      const h = harness({status: 0, stdout: STAGED}, FAILED);
      expect(await deploy('staged', h.options)).toBe(1);
      expect(h.lines).toContain(
        `::error::vercel remove failed (exit 1); delete ${STAGED} in the Vercel dashboard.`,
      );
    });
  });

  describe('parseArgs', () => {
    const env = {VERCEL_CLI_VERSION: '60.0.0', VERCEL_TOKEN: 't'};

    it('reads the mode, the CLI version and the token', () => {
      expect(parseArgs(['staged'], env)).toEqual({mode: 'staged', version: '60.0.0', token: 't'});
    });

    it.each([[[]], [['preview']], [['toString']]])('refuses %j with the usage line', (argv) => {
      expect(parseArgs(argv, env).error).toMatch(/^Usage:/);
    });

    it.each(['VERCEL_CLI_VERSION', 'VERCEL_TOKEN'])('names a missing %s', (name) => {
      expect(parseArgs(['production'], {...env, [name]: ''}).error).toContain(name);
    });
  });
});
