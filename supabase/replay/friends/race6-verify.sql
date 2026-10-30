-- After race 6: both old tries are gone, and Q's send was recorded beside its try from race 1.
\set ON_ERROR_STOP on
do $$
declare n int;
begin
  select count(*) into n from internal.friend_request_attempts
   where sender_id in (t.uid('P'), t.uid('Q')) and attempted_at < now() - interval '1 hour';
  assert n = 0, format('race 6: %s of P''s and Q''s old tries are left', n);
  select count(*) into n from internal.friend_request_attempts where sender_id = t.uid('Q');
  assert n = 2, format('race 6: Q has %s recorded tries, not its race 1 try and this one', n);
end $$;
\echo '== race 6 passed'
