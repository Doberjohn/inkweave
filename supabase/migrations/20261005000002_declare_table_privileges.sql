-- Applied 2026-10-05 as 20261005140345 (#706). The filename stamp and the applied
-- version differ by repo convention: the MCP assigns its own timestamp at apply time.
-- The collections UPDATE grant below misses owner_id, which PostgREST's upsert also
-- sets; 20261005000003 adds it.
--
-- Declarative, not additive. Each object is reset for the client roles and then granted
-- exactly what its RLS policies and the app assume, so the end state is identical whether
-- the platform granted ALL by default (older projects) or nothing (new projects since
-- 2026-05-30, and every project's new tables from 2026-10-30).
--
-- TRIGGER and MAINTAIN are deliberately not granted to anon or authenticated: no client
-- role needs either. They are on the live project only because they came with the
-- default ALL.
--
-- service_role is restated with ALL, which is what it holds today. Server-side tools use
-- it (the admin vote analytics read votes), and Supabase's new default grants it nothing.
--
-- A table-level REVOKE also revokes that privilege on every column, so each block below
-- re-grants its column privileges after the reset.

-- profiles: world-readable once a handle exists (RLS decides which rows); the owner may
-- edit only the two columns that are theirs to set. handle is permanent (#705).
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to anon, authenticated;
grant insert on public.profiles to authenticated;
grant update (display_name, avatar_url) on public.profiles to authenticated;
grant all on public.profiles to service_role;

-- decks: anon may read (RLS narrows to is_public); owners get the four verbs.
revoke all on public.decks from anon, authenticated;
grant select on public.decks to anon, authenticated;
grant insert, update, delete on public.decks to authenticated;
grant all on public.decks to service_role;

-- collections: anon gets nothing at all. Unlike a deck, a collection is never public.
-- Column-scoped writes match exactly what collectionRepository sends; updated_at is
-- omitted because the collections_set_updated_at trigger owns it (#705).
revoke all on public.collections from anon, authenticated;
grant select, delete on public.collections to authenticated;
grant insert (owner_id, entries, imported_at, schema_version)
  on public.collections to authenticated;
grant update (entries, imported_at, schema_version)
  on public.collections to authenticated;
grant all on public.collections to service_role;

-- votes: writes only through submit_vote (SECURITY DEFINER). Reads are column-scoped:
-- pair_scores is a security_invoker view, so it reads votes with the CALLER's
-- privileges and needs exactly these eight columns. id, ip_hash and created_at stay
-- unreadable. Restates 20260925000000_harden_votes_access.
revoke all on public.votes from anon, authenticated;
grant select (card_a_id, card_b_id, score, accuracy, is_real, would_play, difficulty, who_carries)
  on public.votes to anon, authenticated;
grant all on public.votes to service_role;

-- pair_scores: a read-only aggregate view. Its write privileges on the live project are
-- inert (information_schema reports is_updatable = NO) but should not be held.
revoke all on public.pair_scores from anon, authenticated;
grant select on public.pair_scores to anon, authenticated;
grant all on public.pair_scores to service_role;
