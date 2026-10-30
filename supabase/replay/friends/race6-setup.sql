-- Race 6 setup: P and Q (race-setup.sql's) each have a try from two hours ago.
\set ON_ERROR_STOP on
\pset tuples_only on
insert into internal.friend_request_attempts (sender_id, attempted_at)
select t.uid(n), now() - interval '2 hours' from unnest(array['P', 'Q']) n;
