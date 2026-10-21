-- Race 5, second session, a second later: N's 31st try while the 30th is uncommitted.
\set ON_ERROR_STOP on
\pset tuples_only on
select pg_sleep(1);
begin;
select t.act_as('N');
\timing on
select 'race5 31st try: ' || status from public.send_friend_request(t.code_of('O'));
\timing off
commit;
