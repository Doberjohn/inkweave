-- After race 5: the limit held under overlapping tries.
\set ON_ERROR_STOP on
do $$
declare n int;
begin
  select count(*) into n from internal.friend_request_attempts where sender_id = t.uid('N');
  assert n = 30, format('race 5: N has %s recorded tries', n);
  select count(*) into n from public.friendships where requester_id = t.uid('N');
  assert n = 0, format('race 5: N sent %s requests', n);
end $$;
\echo '== race 5 passed'
