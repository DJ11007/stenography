-- A health check for every published Word and Excel Efficiency paper (22 Nov 2026): each paper's model answer must
-- score full marks against its own marking rules, and the untouched paper must score 0. Run after editing a paper:
--   select * from public.efficiency_paper_check();          -- only the papers with a problem
--   select * from public.efficiency_paper_check(true);      -- every paper
-- Read-only; not callable by students (service role / SQL editor only).
create or replace function public.efficiency_paper_check(p_all boolean default false)
returns table (kind text, language text, title text, maximum numeric, model_answer numeric, untouched numeric, short_questions text, free_questions text)
language sql
stable
set search_path to 'pg_catalog', 'public'
as $function$
  with excel as (
    select 'Excel'::text kind, t.language, t.title, q.question_number n, q.marks,
      public.excel_efficiency_score_question(v.model_answer_snapshot, v.id, q.id, q.marks) model,
      public.excel_efficiency_score_question(v.working_matter_snapshot, v.id, q.id, q.marks) blank
    from public.excel_efficiency_tests t join public.excel_efficiency_versions v on v.id = t.current_version_id
    join public.excel_efficiency_questions q on q.version_id = v.id where t.status = 'published'),
  word as (
    select 'Word'::text kind, t.language, t.title, q.question_number n, q.marks,
      (public.word_efficiency_score_question(v.model_answer_snapshot, v.id, q.id, q.marks, v.model_answer_snapshot)).awarded model,
      (public.word_efficiency_score_question(v.working_matter_snapshot, v.id, q.id, q.marks, v.model_answer_snapshot)).awarded blank
    from public.word_efficiency_tests t join public.word_efficiency_versions v on v.id = t.current_version_id
    join public.word_efficiency_questions q on q.version_id = v.id where t.status = 'published'),
  scored as (select * from excel union all select * from word)
  select kind, language, title, sum(marks), round(sum(coalesce(model, 0)), 2), round(sum(coalesce(blank, 0)), 2),
    string_agg(case when coalesce(model, 0) < marks then n::text end, ',' order by n),
    string_agg(case when coalesce(blank, 0) > 0 then n::text end, ',' order by n)
  from scored group by kind, language, title
  having p_all or sum(coalesce(model, 0)) < sum(marks) or sum(coalesce(blank, 0)) > 0
  order by kind, language, title
$function$;
revoke all on function public.efficiency_paper_check(boolean) from public, anon, authenticated;
