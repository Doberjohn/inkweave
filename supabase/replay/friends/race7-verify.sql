-- After race 7: T's old tries are gone, and its send was recorded.
\set ON_ERROR_STOP on
do $$
declare n int;
begin
  select count(*) into n from internal.friend_request_attempts where sender_id = t.uid('T');
  assert n = 1, format('race 7: T has %s recorded tries', n);
end $$;
\echo '== race 7 passed'
