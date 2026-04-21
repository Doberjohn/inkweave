/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SENTRY_DSN?: string;
  readonly VITE_LOCAL_IMAGES?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_IS_REVEAL_SEASON?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
