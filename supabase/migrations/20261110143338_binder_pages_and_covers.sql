-- Applied in the Supabase SQL editor like 20261103064319 (its grants say update, so
-- apply_migration's confirmation would never reach the owner), in one transaction with its
-- history row under the filename stamp, whose statements hold this file's text. It needs
-- 20261103064319 first.
--
-- A binder's page size and cover design, and My collection's.
--
-- pages   the side of a page: 2, 3 or 4 pockets across and down. 4 for every binder until
--         its player picks another.
-- cover   a design's id ('starry-night', 'tartan'), null for the first design. The app keeps
--         the designs, so the column checks only the id's shape: a later design needs no
--         migration, and the app draws an id it doesn't know as the first.
--
-- cover_id, the card a cover named before, stays in both tables, unread and unwritten, until a
-- later migration drops it with the card id remap's cover step.

alter table public.collection_binders
  add column pages smallint not null default 4,
  add column cover text,
  add constraint collection_binders_pages check (pages in (2, 3, 4)),
  add constraint collection_binders_cover_design check (cover ~ '^[a-z][a-z-]{0,23}$');

alter table public.collection_shelf
  add column pages smallint not null default 4,
  add column cover text,
  add constraint collection_shelf_pages check (pages in (2, 3, 4)),
  add constraint collection_shelf_cover_design check (cover ~ '^[a-z][a-z-]{0,23}$');

-- The client sends both with a new binder and changes either later. The shelf's upsert sends
-- owner_id and the columns it changes, whose grants 20261103064319 gave owner_id already.
grant insert (pages, cover), update (pages, cover) on public.collection_binders to authenticated;
grant insert (pages, cover), update (pages, cover) on public.collection_shelf to authenticated;
