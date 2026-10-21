-- After the three races: one accepted P-Q row, one pending P-R row, one code for Y.
\set ON_ERROR_STOP on
\pset tuples_only on
do $$
declare n int; s text;
begin
  select count(*), min(status) into n, s from public.friendships
   where least(requester_id, addressee_id) = least(t.uid('P'), t.uid('Q'))
     and greatest(requester_id, addressee_id) = greatest(t.uid('P'), t.uid('Q'));
  assert n = 1 and s = 'accepted', format('race 1: %s rows, status %s', n, s);
  select count(*), min(status) into n, s from public.friendships
   where requester_id = t.uid('P') and addressee_id = t.uid('R');
  assert n = 1 and s = 'pending', format('race 2: %s rows, status %s', n, s);
  select count(*) into n from public.friend_codes where owner_id = t.uid('Y');
  assert n = 1, format('race 3: Y has %s code rows', n);
end $$;
\echo '== all race checks passed'
