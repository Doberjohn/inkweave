-- Race 4, second session, a second later: S sends to T21 while the 20th is uncommitted.
\set ON_ERROR_STOP on
\pset tuples_only on
select pg_sleep(1);
begin;
select t.act_as('S');
\timing on
select 'race4 S->T21: ' || status from public.send_friend_request(t.code_of('T21'));
\timing off
commit;
