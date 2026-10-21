-- After race 4: the cap held under overlapping sends.
\set ON_ERROR_STOP on
do $$
declare n int;
begin
  select count(*) into n from public.friendships where requester_id = t.uid('S') and status = 'pending';
  assert n = 20, format('race 4: S has %s requests waiting', n);
end $$;
\echo '== race 4 passed'
