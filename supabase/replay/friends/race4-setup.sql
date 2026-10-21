-- Race 4 setup: S already has 19 requests waiting; T20 and T21 hold codes.
\set ON_ERROR_STOP on
\pset tuples_only on
select t.make_user('S');
select t.make_user('T' || i) from generate_series(1, 21) i;
insert into public.friend_codes (owner_id, code)
select t.uid('T' || i), public.random_friend_code() from generate_series(1, 21) i;
insert into public.friendships (requester_id, addressee_id)
select t.uid('S'), t.uid('T' || i) from generate_series(1, 19) i;
