-- Admin "Check marks" on the Model Answer pages (23 Nov 2026): score the sheet / document being edited against the
-- paper's saved marking rules, question by question, without creating a student attempt -- so a teacher can test a
-- paper without signing in as a student (whose results such test attempts used to land in). Admins (AAL2) only;
-- nothing is saved.
create or replace function public.check_excel_efficiency_sheet(p_version_id uuid, p_document jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
begin
  if not public.is_aal2_admin() then raise exception 'admin access required'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('number', s.n, 'maximum', s.marks, 'awarded', s.awarded,
      'hint', case when s.awarded < s.marks then nullif(btrim(public.excel_efficiency_wrong_cell_hint(p_document, s.id)), '') end) order by s.n)
    from (select q.id, q.question_number n, q.marks, public.excel_efficiency_score_question(p_document, p_version_id, q.id, q.marks) awarded
          from public.excel_efficiency_questions q where q.version_id = p_version_id) s), '[]'::jsonb);
end
$function$;
revoke all on function public.check_excel_efficiency_sheet(uuid, jsonb) from public, anon;
grant execute on function public.check_excel_efficiency_sheet(uuid, jsonb) to authenticated;

create or replace function public.check_word_efficiency_document(p_version_id uuid, p_document jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare model jsonb;
begin
  if not public.is_aal2_admin() then raise exception 'admin access required'; end if;
  select v.model_answer_snapshot into model from public.word_efficiency_versions v where v.id = p_version_id;
  return coalesce((
    select jsonb_agg(jsonb_build_object('number', q.question_number, 'maximum', q.marks,
      'awarded', round((public.word_efficiency_score_question(p_document, p_version_id, q.id, q.marks, model)).awarded, 2)) order by q.question_number)
    from public.word_efficiency_questions q where q.version_id = p_version_id), '[]'::jsonb);
end
$function$;
revoke all on function public.check_word_efficiency_document(uuid, jsonb) from public, anon;
grant execute on function public.check_word_efficiency_document(uuid, jsonb) to authenticated;
