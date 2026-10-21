-- Race 1, first session: P sends to Q and holds the transaction open for 3 s.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
select t.act_as('P');
select 'race1 P->Q: ' || status from public.send_friend_request(t.code_of('Q'));
select pg_sleep(3);
commit;
