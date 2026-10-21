-- Race 3, second session, a second later: Y's other first claim, before the first commits.
\set ON_ERROR_STOP on
\pset tuples_only on
select pg_sleep(1);
begin;
select t.act_as('Y');
\timing on
select 'race3 second claim: ' || public.claim_friend_code();
\timing off
commit;
