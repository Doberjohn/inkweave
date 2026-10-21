-- Race 3, first session: Y's first claim, held open for 3 s.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
select t.act_as('Y');
do $$
declare code text := public.claim_friend_code();
begin
  raise notice 'race3 first claim: %', code;
  assert code ~ '^[0-9A-HJKMNP-TV-Z]{8}$', format('race 3, first claim: %s', code);
end $$;
select pg_sleep(3);
commit;
