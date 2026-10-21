-- Race 1, second session, a second later: Q sends to P while P's insert is uncommitted.
\set ON_ERROR_STOP on
\pset tuples_only on
select pg_sleep(1);
begin;
select t.act_as('Q');
\timing on
select 'race1 Q->P: ' || status || ', friend is P: ' || (friend_id = t.uid('P'))
  from public.send_friend_request(t.code_of('P'));
\timing off
commit;
