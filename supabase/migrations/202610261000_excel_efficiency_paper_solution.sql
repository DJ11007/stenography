-- Excel Efficiency: a paper solution for students. Each question can carry solution steps (the same text format
-- as questions: bold, lists, tables) and one screenshot (an image data URI, resized in the browser). A student
-- sees the solution from the result page once their attempt's result is published, and never while the test's
-- live window is open (so it cannot reach students still taking the live test).
begin;

alter table public.excel_efficiency_questions add column if not exists solution text;
alter table public.excel_efficiency_questions add column if not exists solution_image text;
alter table public.excel_efficiency_questions drop constraint if exists excel_efficiency_questions_solution_check;
alter table public.excel_efficiency_questions add constraint excel_efficiency_questions_solution_check check (
  (solution is null or length(solution) <= 8000)
  and (solution_image is null or (length(solution_image) <= 700000 and solution_image ~ '^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$')));

-- Saving a test (a new version each time) keeps each question's solution.
do $mig$
declare def text;
begin
 def := pg_get_functiondef('public.save_excel_efficiency_test(uuid,jsonb)'::regprocedure);
 if position('solution_image' in def) = 0 then
  if position('insert into public.excel_efficiency_questions(version_id,question_number,instruction,marks,section,display_order,is_visible) values(vid,(q->>''number'')::integer,q->>''instruction'',(q->>''marks'')::numeric,nullif(q->>''section'',''''),coalesce((q->>''display_order'')::integer,(q->>''number'')::integer),coalesce((q->>''is_visible'')::boolean,true));' in def) = 0 then raise exception 'question insert not found'; end if;
  def := replace(def,
   'insert into public.excel_efficiency_questions(version_id,question_number,instruction,marks,section,display_order,is_visible) values(vid,(q->>''number'')::integer,q->>''instruction'',(q->>''marks'')::numeric,nullif(q->>''section'',''''),coalesce((q->>''display_order'')::integer,(q->>''number'')::integer),coalesce((q->>''is_visible'')::boolean,true));',
   'insert into public.excel_efficiency_questions(version_id,question_number,instruction,marks,section,display_order,is_visible,solution,solution_image) values(vid,(q->>''number'')::integer,q->>''instruction'',(q->>''marks'')::numeric,nullif(q->>''section'',''''),coalesce((q->>''display_order'')::integer,(q->>''number'')::integer),coalesce((q->>''is_visible'')::boolean,true),nullif(btrim(coalesce(q->>''solution'','''')),''''),nullif(q->>''solution_image'',''''));');
  execute def;
 end if;
end $mig$;

-- Whether this attempt's student may see the paper solution now, and why not.
create or replace function public.excel_efficiency_solution_status(p_attempt_id uuid)
returns jsonb language plpgsql stable security definer set search_path to 'pg_catalog', 'public' as $function$
declare a public.excel_efficiency_attempts%rowtype; t public.excel_efficiency_tests%rowtype; has_solution boolean;
begin
 select * into a from public.excel_efficiency_attempts where id = p_attempt_id;
 if not found or (a.student_id is distinct from auth.uid() and not public.is_aal2_admin()) then return jsonb_build_object('available', false, 'reason', 'not found'); end if;
 select * into t from public.excel_efficiency_tests where id = a.test_id;
 select exists (select 1 from public.excel_efficiency_questions q where q.version_id = a.version_id and (q.solution is not null or q.solution_image is not null)) into has_solution;
 if not has_solution then return jsonb_build_object('available', false, 'reason', 'none'); end if;
 if a.result_published_at is null then return jsonb_build_object('available', false, 'reason', 'result pending'); end if;
 if t.is_live and now() >= t.live_starts_at and now() < t.live_ends_at then return jsonb_build_object('available', false, 'reason', 'live', 'opensAt', t.live_ends_at); end if;
 return jsonb_build_object('available', true);
end $function$;

-- The paper solution with the student's own marks per question, when the status allows it.
create or replace function public.get_excel_efficiency_solution(p_attempt_id uuid)
returns jsonb language plpgsql stable security definer set search_path to 'pg_catalog', 'public' as $function$
declare status jsonb; a public.excel_efficiency_attempts%rowtype;
begin
 status := public.excel_efficiency_solution_status(p_attempt_id);
 if not coalesce((status->>'available')::boolean, false) then return status; end if;
 select * into a from public.excel_efficiency_attempts where id = p_attempt_id;
 return status || jsonb_build_object('title', a.snapshot->>'title', 'questions', coalesce((
  select jsonb_agg(jsonb_build_object('number', q.question_number, 'instruction', q.instruction, 'marks', q.marks, 'solution', q.solution, 'image', q.solution_image,
    'awarded', (select s.awarded_marks from public.excel_efficiency_question_scores s where s.attempt_id = a.id and s.question_id = q.id)) order by q.display_order, q.question_number)
  from public.excel_efficiency_questions q where q.version_id = a.version_id and q.is_visible), '[]'::jsonb));
end $function$;

revoke all on function public.excel_efficiency_solution_status(uuid) from public, anon;
revoke all on function public.get_excel_efficiency_solution(uuid) from public, anon;
grant execute on function public.excel_efficiency_solution_status(uuid) to authenticated;
grant execute on function public.get_excel_efficiency_solution(uuid) to authenticated;

commit;
