#!/usr/bin/env node
/**
 * `vercel deploy` for .github/workflows/deploy.yml and deploy-staging.yml, retried once (#698).
 *
 *   node scripts/vercel-deploy.mjs production   push to master: deploy and promote
 *   node scripts/vercel-deploy.mjs staged       PR dry run: deploy unpromoted, then remove it
 *   node scripts/vercel-deploy.mjs staging      push to master: deploy the Preview build, then
 *                                               point staging.inkweave.ink at it (#741)
 *
 * Why the retry: @vercel/client (CLI 60.0.0) uploads 50 files at once and retries a failed
 * upload only for a fixed list of error messages, which undici's socket errors miss, so one bad
 * connection failed a whole deploy (run 36927032087). A retry re-sends only what Vercel still
 * lacks, since the upload first asks which files it has. Two failures in a row are likely real,
 * so the job fails and the drift alarm (#569) fires.
 *
 * staged uploads the dry run's build as a new production deployment that never receives
 * inkweave.ink (see MODES), then removes it. Prebuilt output must deploy to the target it was
 * built for, and the dry run builds with --prod, so a preview deploy can't stand in.
 * `vercel deploy` prints only the deployment URL on stdout, and that URL is the one thing
 * `vercel remove` ever receives.
 *
 * staging deploys a build made without --prod, so the deployment is a preview and no production
 * domain can move to it. `vercel alias set`, retried once like the deploy, then moves
 * staging.inkweave.ink to that URL. Until the alias succeeds, staging keeps serving the previous
 * build.
 *
 * Reads VERCEL_CLI_VERSION and VERCEL_TOKEN from the environment. CI only: with a token, it runs
 * the Vercel CLI through npx.
 */
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// The one shape `vercel remove` and `vercel alias set` may receive. A bare name like "inkweave"
// would remove the whole project (Vercel docs), so anything that isn't exactly one deployment URL
// is refused. Preview and production deployment URLs share this shape.
export const DEPLOYMENT_URL = /^https:\/\/inkweave-[a-z0-9]+-johnfanidis-projects\.vercel\.app$/;

export const STAGING_HOST = 'staging.inkweave.ink';

const RETRY_DELAY_MS = 15_000;

// The flags after `deploy --prebuilt`, and the step that runs once the deploy succeeds.
// production and staged target production, because their build was --prod. staged adds
// --skip-domain, so inkweave.ink is never assigned (the generated *.vercel.app production URL
// still moves to it: see deploy.yml's dry-run step), and --force (the API's forceNew). Without
// it Vercel may hand back a similar earlier deployment instead of creating one (deduplication),
// and that could be the live production deployment, whose URL the guard above can't tell apart
// from a staged one. staging adds nothing: its build had no --prod, so it deploys as a preview.
const MODES = {
  production: {flags: ['--prod']},
  staged: {flags: ['--prod', '--skip-domain', '--force'], afterDeploy: removeStaged},
  staging: {flags: [], afterDeploy: aliasStaging},
};

const USAGE = 'Usage: node scripts/vercel-deploy.mjs <production|staged|staging>';

/** The mode from `argv` and the CLI version and token from `env`, or an `error` to print. */
export function parseArgs([mode], env) {
  if (!Object.hasOwn(MODES, mode)) return {error: USAGE};
  const missing = ['VERCEL_CLI_VERSION', 'VERCEL_TOKEN'].filter((name) => !env[name]);
  if (missing.length) return {error: `Missing ${missing.join(' and ')} in the environment`};
  return {mode, version: env.VERCEL_CLI_VERSION, token: env.VERCEL_TOKEN};
}

/**
 * Deploys in `mode` and resolves to the exit code. `vercel(args, {capture})` runs the Vercel CLI
 * and returns `{status, stdout}`, stdout only when captured; `sleep(ms)` waits; `log` prints.
 */
export async function deploy(mode, {token, vercel, sleep, log}) {
  const {flags, afterDeploy} = MODES[mode];
  const cli = {auth: `--token=${token}`, vercel, sleep, log};
  const result = await withRetry(cli, ['deploy', '--prebuilt', ...flags, cli.auth], {
    capture: Boolean(afterDeploy),
  });
  if (!afterDeploy || result.status !== 0) return result.status;
  return afterDeploy(result.stdout.trim(), cli);
}

// Runs `vercel <args>`, then once more after RETRY_DELAY_MS if that fails.
async function withRetry({vercel, sleep, log}, args, {capture = false} = {}) {
  const first = vercel(args, {capture});
  if (first.status === 0) return first;
  log(
    `::warning::vercel ${args[0]} failed (exit ${first.status}); retrying once in ${RETRY_DELAY_MS / 1000} s`,
  );
  await sleep(RETRY_DELAY_MS);
  return vercel(args, {capture});
}

function removeStaged(url, {auth, vercel, log}) {
  if (!DEPLOYMENT_URL.test(url)) {
    log(
      `::error::Unexpected deployment URL ${JSON.stringify(url)}; nothing removed. Delete the staged deployment in the Vercel dashboard.`,
    );
    return 1;
  }
  log(`Staged ${url}, never promoted; removing it`);
  const {status} = vercel(['remove', url, '--yes', auth]);
  if (status !== 0) {
    log(`::error::vercel remove failed (exit ${status}); delete ${url} in the Vercel dashboard.`);
  }
  return status;
}

async function aliasStaging(url, cli) {
  if (!DEPLOYMENT_URL.test(url)) {
    cli.log(
      `::error::Unexpected deployment URL ${JSON.stringify(url)}; ${STAGING_HOST} was not moved.`,
    );
    return 1;
  }
  cli.log(`Deployed ${url}; pointing ${STAGING_HOST} at it`);
  const {status} = await withRetry(cli, ['alias', 'set', url, STAGING_HOST, cli.auth]);
  if (status !== 0) {
    cli.log(
      `::error::vercel alias set failed (exit ${status}); ${STAGING_HOST} may still serve the previous build. Re-run this job to retry.`,
    );
  }
  return status;
}

// `npx vercel@<version> <args>`. stdout is piped only when captured; a spawn error or a signal
// counts as a failed run.
function npxVercel(version) {
  return (args, {capture = false} = {}) => {
    const result = spawnSync('npx', [`vercel@${version}`, ...args], {
      stdio: ['inherit', capture ? 'pipe' : 'inherit', 'inherit'],
      encoding: 'utf8',
    });
    if (result.error) console.error(`npx vercel: ${result.error.message}`);
    return {status: result.status ?? 1, stdout: result.stdout ?? ''};
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const options = parseArgs(process.argv.slice(2), process.env);
  if (options.error) {
    console.error(options.error);
    process.exitCode = 1;
  } else {
    process.exitCode = await deploy(options.mode, {
      token: options.token,
      vercel: npxVercel(options.version),
      sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
      log: console.log,
    });
  }
}
