-- Players for the race checks: P, Q and R hold codes; Y has none yet.
\set ON_ERROR_STOP on
\pset tuples_only on
select t.make_user(n) from unnest(array['P', 'Q', 'R', 'Y']) n;
insert into public.friend_codes (owner_id, code)
select t.uid(n), public.random_friend_code() from unnest(array['P', 'Q', 'R']) n;
