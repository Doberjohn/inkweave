/**
 * Local Windows runs cap Vitest at 4 workers (#720). The repo sits on a spinning disk there, and
 * on a cold file cache the default first wave (11 workers on the 12-thread dev box) needs over
 * 60 s to start, mostly loading jsdom, past Vitest's hardcoded worker-start limit, so none of its
 * files run. Four workers measured 35 to 43 s. CI keeps Vitest's default: it has never hit this.
 * VITEST_MAX_WORKERS overrides the cap. The app's config and inkweave-ui's both take it from here.
 */
export function resolveVitestWorkers(): number | undefined {
  const override = Number.parseInt(process.env.VITEST_MAX_WORKERS ?? '', 10);
  if (override > 0) return override;
  if (process.env.CI) return undefined;
  return process.platform === 'win32' ? 4 : undefined;
}
