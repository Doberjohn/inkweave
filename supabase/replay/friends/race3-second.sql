-- Race 3, second session, a second later: Y's other first claim, before the first commits.
\set ON_ERROR_STOP on
\pset tuples_only on
select pg_sleep(1);
begin;
select t.act_as('Y');
\timing on
do $$
declare code text := public.claim_friend_code();
begin
  raise notice 'race3 second claim: %', code;
  -- The first claim's code, which has committed by now: one code per player.
  assert code = t.code_of('Y'), format('race 3, second claim: %s, stored: %s', code, t.code_of('Y'));
end $$;
\timing off
commit;
