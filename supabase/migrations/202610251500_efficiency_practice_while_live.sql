-- A live Word/Excel efficiency test is also open as ordinary practice in the Efficiency section, any
-- time, as often as the student wants. Only an attempt started from the Live Test page (p_live true) is
-- the live attempt: live window, one attempt, the set duration, results 15 minutes after submitting,
-- on the live leaderboard. p_live defaults to true so an older page keeps today's behaviour.
begin;

do $mig$
declare def text;
begin
  def := pg_get_functiondef('public.prepare_word_efficiency_attempt(uuid,integer,text)'::regprocedure);
  if position('p_delivery text)' in def)=0 or position('test_record.is_live' in def)=0 then raise exception 'prepare_word_efficiency_attempt: expected text not found'; end if;
  def := replace(def, 'p_delivery text)', 'p_delivery text, p_live boolean DEFAULT true)');
  def := replace(def, 'test_record.is_live', '(test_record.is_live and coalesce(p_live,true))');
  drop function public.prepare_word_efficiency_attempt(uuid,integer,text);
  execute def;
  grant execute on function public.prepare_word_efficiency_attempt(uuid,integer,text,boolean) to authenticated, service_role;
  revoke execute on function public.prepare_word_efficiency_attempt(uuid,integer,text,boolean) from public, anon;
end $mig$;

do $mig$
declare def text;
begin
  def := pg_get_functiondef('public.prepare_excel_efficiency_attempt(uuid,integer,boolean)'::regprocedure);
  if position('p_show_questions boolean)' in def)=0 or position('t.is_live' in def)=0 then raise exception 'prepare_excel_efficiency_attempt: expected text not found'; end if;
  def := replace(def, 'p_show_questions boolean)', 'p_show_questions boolean, p_live boolean DEFAULT true)');
  def := replace(def, 't.is_live', '(t.is_live and coalesce(p_live,true))');
  drop function public.prepare_excel_efficiency_attempt(uuid,integer,boolean);
  execute def;
  grant execute on function public.prepare_excel_efficiency_attempt(uuid,integer,boolean,boolean) to authenticated, service_role;
  revoke execute on function public.prepare_excel_efficiency_attempt(uuid,integer,boolean,boolean) from public, anon;
end $mig$;

commit;
