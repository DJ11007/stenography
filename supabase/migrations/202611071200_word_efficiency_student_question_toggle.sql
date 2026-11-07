-- Word Efficiency: the admin decides whether students may hide/show the on-screen questions, as Excel already does
-- (202610252100). Off: the questions always show and the start page and workspace drop the Hide/Show control.
-- Existing tests keep the toggle (default on).
begin;

alter table public.word_efficiency_versions add column if not exists student_question_toggle boolean not null default true;

create or replace function public.set_word_efficiency_question_toggle(p_test_id uuid, p_student_toggle boolean)
returns void
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare v_version uuid;
begin
  if not public.is_aal2_admin() then raise exception 'not authorized'; end if;
  select current_version_id into v_version from public.word_efficiency_tests where id = p_test_id;
  if v_version is null then raise exception 'test unavailable'; end if;
  update public.word_efficiency_versions set student_question_toggle = coalesce(p_student_toggle, true) where id = v_version;
end $function$;
revoke all on function public.set_word_efficiency_question_toggle(uuid, boolean) from public, anon;
grant execute on function public.set_word_efficiency_question_toggle(uuid, boolean) to authenticated;

-- The attempt follows the version's setting whatever the start form sends.
do $mig$
declare src text;
begin
  src := pg_get_functiondef('public.initialize_word_efficiency_document(uuid, boolean)'::regprocedure);
  if position('question_toggle' in src) = 0 then
    src := replace(src, $a$'show_questions',coalesce(p_show_questions,false))$a$,
      $b$'show_questions',coalesce(p_show_questions,false) or not coalesce((select version_rows.student_question_toggle from public.word_efficiency_versions as version_rows join public.word_efficiency_attempts as toggle_attempts on toggle_attempts.version_id=version_rows.id where toggle_attempts.id=p_attempt_id),true),'question_toggle',coalesce((select version_rows.student_question_toggle from public.word_efficiency_versions as version_rows join public.word_efficiency_attempts as toggle_attempts on toggle_attempts.version_id=version_rows.id where toggle_attempts.id=p_attempt_id),true))$b$);
    if position('question_toggle' in src) = 0 then raise exception 'initialize_word_efficiency_document: snapshot text not found'; end if;
    execute src;
  end if;
end $mig$;

commit;
