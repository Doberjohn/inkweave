-- Race 5 setup: N already has 29 tries recorded; O holds a code.
\set ON_ERROR_STOP on
\pset tuples_only on
select t.make_user(n) from unnest(array['N', 'O']) n;
insert into public.friend_codes (owner_id, code) values (t.uid('O'), public.random_friend_code());
insert into internal.friend_request_attempts (sender_id)
select t.uid('N') from generate_series(1, 29);
