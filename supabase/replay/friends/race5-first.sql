-- Race 5, first session: N's 30th try, held open for 3 s.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
select t.act_as('N');
select 'race5 30th try: ' || status from public.send_friend_request('ZZZZ-ZZZZ');
select pg_sleep(3);
commit;
