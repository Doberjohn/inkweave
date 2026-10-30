-- The decks and collections blocks of 20261005000002_declare_table_privileges.sql, copied
-- verbatim, so players act under production's grants. The file itself can't load here: its
-- votes and pair_scores blocks name columns and a view the stand-ins lack. 20261005000000,
-- which it restates, adds nothing to them. Load it in 20261005000002's place, before
-- 20261005000003, whose owner_id grant its revoke would drop. Copy here any later grant on
-- either table whose migration the replay doesn't load after this file.

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
