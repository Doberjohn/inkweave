-- Fix: pair_scores view lost security_invoker after being recreated outside migrations.
-- ALTER VIEW preserves the option without needing to drop/recreate.
ALTER VIEW public.pair_scores SET (security_invoker = on);
