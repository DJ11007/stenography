-- Excel Efficiency paper solution: an attempt taken before the admin added the solution (an older version of the
-- same test, with the same questions word for word) shows the current version's solution.
begin;

-- The version whose solution an attempt shows: its own if it has one, else the test's current version when that
-- has a solution and the very same questions (number, wording, marks).
create or replace function public.excel_efficiency_solution_version(p_attempt_id uuid)
returns uuid language sql stable security definer set search_path to 'pg_catalog', 'public' as $function$
 with a as (select version_id, test_id from public.excel_efficiency_attempts where id = p_attempt_id),
 own as (select a.version_id from a where exists (select 1 from public.excel_efficiency_questions q where q.version_id = a.version_id and (q.solution is not null or q.solution_image is not null))),
 cur as (
  select t.current_version_id as version_id from a join public.excel_efficiency_tests t on t.id = a.test_id
  where t.current_version_id <> a.version_id
    and exists (select 1 from public.excel_efficiency_questions q where q.version_id = t.current_version_id and (q.solution is not null or q.solution_image is not null))
    and not exists (
      (select question_number, btrim(instruction), marks from public.excel_efficiency_questions where version_id = a.version_id
       except select question_number, btrim(instruction), marks from public.excel_efficiency_questions where version_id = t.current_version_id)
      union all
      (select question_number, btrim(instruction), marks from public.excel_efficiency_questions where version_id = t.current_version_id
       except select question_number, btrim(instruction), marks from public.excel_efficiency_questions where version_id = a.version_id)))
 select coalesce((select version_id from own), (select version_id from cur))
$function$;
revoke all on function public.excel_efficiency_solution_version(uuid) from public, anon, authenticated;

create or replace function public.excel_efficiency_solution_status(p_attempt_id uuid)
returns jsonb language plpgsql stable security definer set search_path to 'pg_catalog', 'public' as $function$
declare a public.excel_efficiency_attempts%rowtype; t public.excel_efficiency_tests%rowtype;
begin
 select * into a from public.excel_efficiency_attempts where id = p_attempt_id;
 if not found or (a.student_id is distinct from auth.uid() and not public.is_aal2_admin()) then return jsonb_build_object('available', false, 'reason', 'not found'); end if;
 select * into t from public.excel_efficiency_tests where id = a.test_id;
 if public.excel_efficiency_solution_version(p_attempt_id) is null then return jsonb_build_object('available', false, 'reason', 'none'); end if;
 if a.result_published_at is null then return jsonb_build_object('available', false, 'reason', 'result pending'); end if;
 if t.is_live and now() >= t.live_starts_at and now() < t.live_ends_at then return jsonb_build_object('available', false, 'reason', 'live', 'opensAt', t.live_ends_at); end if;
 return jsonb_build_object('available', true);
end $function$;

create or replace function public.get_excel_efficiency_solution(p_attempt_id uuid)
returns jsonb language plpgsql stable security definer set search_path to 'pg_catalog', 'public' as $function$
declare status jsonb; a public.excel_efficiency_attempts%rowtype; source uuid;
begin
 status := public.excel_efficiency_solution_status(p_attempt_id);
 if not coalesce((status->>'available')::boolean, false) then return status; end if;
 select * into a from public.excel_efficiency_attempts where id = p_attempt_id;
 source := public.excel_efficiency_solution_version(p_attempt_id);
 return status || jsonb_build_object('title', a.snapshot->>'title', 'questions', coalesce((
  select jsonb_agg(jsonb_build_object('number', q.question_number, 'instruction', q.instruction, 'marks', q.marks, 'solution', q.solution, 'image', q.solution_image,
    'awarded', (select s.awarded_marks from public.excel_efficiency_question_scores s where s.attempt_id = a.id and s.question_number = q.question_number)) order by q.display_order, q.question_number)
  from public.excel_efficiency_questions q where q.version_id = source and q.is_visible), '[]'::jsonb));
end $function$;

commit;
