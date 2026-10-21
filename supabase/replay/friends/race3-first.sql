-- Race 3, first session: Y's first claim, held open for 3 s.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
select t.act_as('Y');
select 'race3 first claim: ' || public.claim_friend_code();
select pg_sleep(3);
commit;
