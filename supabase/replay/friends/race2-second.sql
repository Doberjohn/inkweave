-- Race 2, second session, a second later: P's second click on the same code.
\set ON_ERROR_STOP on
\pset tuples_only on
select pg_sleep(1);
begin;
select t.act_as('P');
\timing on
select 'race2 second click: ' || status from public.send_friend_request(t.code_of('R'));
\timing off
commit;
