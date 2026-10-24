/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SENTRY_DSN?: string;
  readonly VITE_POSTHOG_KEY?: string;
  readonly VITE_LOCAL_IMAGES?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_IS_REVEAL_SEASON?: string;
  readonly VITE_SHOW_STRATEGY_TIPS?: string;
  readonly VITE_SHOW_BETA_NOTICE?: string;
  readonly VITE_SHOW_ACCOUNTS?: string;
  readonly VITE_SHOW_COLLECTION?: string;
  readonly VITE_SHOW_FRIENDS?: string;
  readonly VITE_FEATURED_CARD_IDS?: string;
}

/** The Vercel deployment environment the build ran for, or 'unknown' (vite.config.ts, #740). */
declare const __DEPLOY_ENV__: string;

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  /**
   * Set only by our own prerender crawl (scripts/prerender.mjs), so the captured pages never
   * load Sentry or PostHog, or bake in their modulepreloads (#640, #827), and /vote's capture
   * shows no pair, since each visit draws its own (#915). Real visitors and PageSpeed never
   * have it.
   */
  __INKWEAVE_PRERENDER__?: boolean;
}
