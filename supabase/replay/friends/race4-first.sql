-- Race 4, first session: S, at 19 waiting, sends to T20 and holds the transaction open for 3 s.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
select t.act_as('S');
select 'race4 S->T20: ' || status from public.send_friend_request(t.code_of('T20'));
select pg_sleep(3);
commit;
