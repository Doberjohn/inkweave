/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SENTRY_DSN?: string;
  readonly VITE_LOCAL_IMAGES?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_IS_REVEAL_SEASON?: string;
  readonly VITE_SHOW_STRATEGY_TIPS?: string;
  readonly VITE_SHOW_BETA_NOTICE?: string;
  readonly VITE_FEATURED_CARD_IDS?: string;
  readonly VITE_DISABLE_REACT_GRAB?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  /**
   * Set only by our own prerender crawl (scripts/prerender.mjs), so the captured pages never
   * load Sentry or bake in its modulepreload (#640). Real visitors and PageSpeed never have it.
   */
  __INKWEAVE_PRERENDER__?: boolean;
}
