-- Race 2, first session: P sends to R and holds the transaction open for 3 s.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
select t.act_as('P');
select 'race2 first click: ' || status from public.send_friend_request(t.code_of('R'));
select pg_sleep(3);
commit;
