-- Excel Efficiency: the admin decides how questions are delivered on screen.
--   delivery_onscreen        questions appear in the workspace (off: the PDF question paper only)
--   student_question_toggle  the student may hide/show the question panel (off: the panel always shows)
-- At least one of on-screen questions or the downloadable PDF must be on.
begin;

alter table public.excel_efficiency_versions add column if not exists delivery_onscreen boolean not null default true;
alter table public.excel_efficiency_versions add column if not exists student_question_toggle boolean not null default true;

create or replace function public.set_excel_efficiency_question_display(p_test_id uuid, p_onscreen boolean, p_student_toggle boolean)
returns void language plpgsql security definer set search_path to 'pg_catalog', 'public' as $function$
declare v_version uuid; v_pdf boolean;
begin
 if not public.is_aal2_admin() then raise exception 'not authorized'; end if;
 select t.current_version_id, v.delivery_pdf into v_version, v_pdf from public.excel_efficiency_tests t join public.excel_efficiency_versions v on v.id = t.current_version_id where t.id = p_test_id;
 if v_version is null then raise exception 'test unavailable'; end if;
 if not coalesce(p_onscreen, true) and not coalesce(v_pdf, false) then raise exception 'Students need the questions: keep On-screen questions, or make the question paper PDF downloadable.'; end if;
 update public.excel_efficiency_versions set delivery_onscreen = coalesce(p_onscreen, true), student_question_toggle = coalesce(p_student_toggle, true) where id = v_version;
end $function$;
revoke all on function public.set_excel_efficiency_question_display(uuid, boolean, boolean) from public, anon;
grant execute on function public.set_excel_efficiency_question_display(uuid, boolean, boolean) to authenticated;

-- The attempt follows the version's settings whatever the start form sends.
do $mig$
declare src text;
begin
 src := pg_get_functiondef('public.prepare_excel_efficiency_attempt(uuid, integer, boolean, boolean)'::regprocedure);
 if position('question_toggle' in src) = 0 then
  src := replace(src, $a$'show_questions',coalesce(p_show_questions,false))$a$,
   $b$'show_questions',case when not v.delivery_onscreen then false when not v.student_question_toggle then true else coalesce(p_show_questions,true) end,'delivery_onscreen',v.delivery_onscreen,'question_toggle',v.delivery_onscreen and v.student_question_toggle)$b$);
  if position('question_toggle' in src) = 0 then raise exception 'prepare_excel_efficiency_attempt: snapshot text not found'; end if;
  execute src;
 end if;
end $mig$;

commit;
