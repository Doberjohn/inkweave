-- Race 7 setup: T has 30 tries, all from two hours ago.
\set ON_ERROR_STOP on
\pset tuples_only on
select t.make_user('T');
insert into internal.friend_request_attempts (sender_id, attempted_at)
select t.uid('T'), now() - interval '2 hours' from generate_series(1, 30);
