-- Word Efficiency: the same paper solution as Excel (migration 202610261000), and re-saving a test in admin keeps
-- its marking. Every save makes a new version; the rules (parts, rule criteria) and the model answer were lost,
-- so a save made only to add solutions would have switched automatic marking off.
begin;

alter table public.word_efficiency_questions add column if not exists solution text;
alter table public.word_efficiency_questions add column if not exists solution_image text;
alter table public.word_efficiency_questions drop constraint if exists word_efficiency_questions_solution_check;
alter table public.word_efficiency_questions add constraint word_efficiency_questions_solution_check check (
  (solution is null or length(solution) <= 8000)
  and (solution_image is null or (length(solution_image) <= 700000 and solution_image ~ '^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$')));

do $mig$
declare def text; old_text text := 'insert into public.word_efficiency_questions(version_id,question_number,instruction,marks,sample_text,section,display_order,is_visible,grading_note)values(vid,(q->>''number'')::integer,coalesce(q->>''instruction'',''''),(q->>''marks'')::numeric,nullif(q->>''sample_text'',''''),nullif(q->>''section'',''''),(q->>''display_order'')::integer,coalesce((q->>''is_visible'')::boolean,true),nullif(q->>''grading_note'',''''));';
begin
 def := pg_get_functiondef('public.save_word_efficiency_test(uuid,jsonb)'::regprocedure);
 if position('solution_image' in def) = 0 then
  if position(old_text in def) = 0 then raise exception 'question insert not found'; end if;
  def := replace(def, old_text, 'insert into public.word_efficiency_questions(version_id,question_number,instruction,marks,sample_text,section,display_order,is_visible,grading_note,solution,solution_image)values(vid,(q->>''number'')::integer,coalesce(q->>''instruction'',''''),(q->>''marks'')::numeric,nullif(q->>''sample_text'',''''),nullif(q->>''section'',''''),(q->>''display_order'')::integer,coalesce((q->>''is_visible'')::boolean,true),nullif(q->>''grading_note'',''''),nullif(btrim(coalesce(q->>''solution'','''')),''''),nullif(q->>''solution_image'',''''));');
  execute def;
 end if;
end $mig$;

-- Re-saving keeps the previous version's rules for questions with the same number, wording and marks, and its
-- model answer when the working document is unchanged.
create or replace function public.copy_word_efficiency_grading_rules(p_from_version uuid, p_to_version uuid)
returns integer language plpgsql security definer set search_path to 'pg_catalog', 'public' as $function$
declare copied integer;
begin
 if not public.is_aal2_admin() then raise exception 'not authorized'; end if;
 if p_from_version is null or p_to_version is null or p_from_version = p_to_version then return 0; end if;
 if (select test_id from public.word_efficiency_versions where id = p_from_version) is distinct from (select test_id from public.word_efficiency_versions where id = p_to_version) then raise exception 'versions belong to different tests'; end if;
 if exists (select 1 from public.word_efficiency_attempts where version_id = p_to_version) then raise exception 'grading rules are immutable after an attempt is prepared'; end if;
 delete from public.word_efficiency_grading_rules r
 using public.word_efficiency_questions o, public.word_efficiency_questions n
 where r.version_id = p_to_version and r.question_id = n.id
  and o.version_id = p_from_version and n.version_id = p_to_version and n.question_number = o.question_number
  and btrim(n.instruction) = btrim(o.instruction) and n.marks = o.marks
  and exists (select 1 from public.word_efficiency_grading_rules x where x.question_id = o.id);
 insert into public.word_efficiency_grading_rules(version_id, question_id, exact_target, expected_operation, expected_value, allocated_marks, partial_marks, additional_criteria, part_label)
 select p_to_version, n.id, r.exact_target, r.expected_operation, r.expected_value, r.allocated_marks, r.partial_marks, r.additional_criteria, r.part_label
 from public.word_efficiency_grading_rules r
 join public.word_efficiency_questions o on o.id = r.question_id
 join public.word_efficiency_questions n on n.version_id = p_to_version and n.question_number = o.question_number and btrim(n.instruction) = btrim(o.instruction) and n.marks = o.marks
 where r.version_id = p_from_version and o.version_id = p_from_version;
 get diagnostics copied = row_count;
 update public.word_efficiency_versions n set model_answer_snapshot = o.model_answer_snapshot
 from public.word_efficiency_versions o
 where n.id = p_to_version and o.id = p_from_version and n.model_answer_snapshot is null and o.model_answer_snapshot is not null
  and n.working_matter_snapshot is not distinct from o.working_matter_snapshot;
 return copied;
end $function$;
revoke all on function public.copy_word_efficiency_grading_rules(uuid, uuid) from public, anon;
grant execute on function public.copy_word_efficiency_grading_rules(uuid, uuid) to authenticated;

-- Paper solution: which version's solution an attempt shows, whether it may be shown now, and the solution itself.
create or replace function public.word_efficiency_solution_version(p_attempt_id uuid)
returns uuid language sql stable security definer set search_path to 'pg_catalog', 'public' as $function$
 with a as (select version_id, test_id from public.word_efficiency_attempts where id = p_attempt_id),
 own as (select a.version_id from a where exists (select 1 from public.word_efficiency_questions q where q.version_id = a.version_id and (q.solution is not null or q.solution_image is not null))),
 cur as (
  select t.current_version_id as version_id from a join public.word_efficiency_tests t on t.id = a.test_id
  where t.current_version_id <> a.version_id
    and exists (select 1 from public.word_efficiency_questions q where q.version_id = t.current_version_id and (q.solution is not null or q.solution_image is not null))
    and not exists (
      (select question_number, btrim(instruction), marks from public.word_efficiency_questions where version_id = a.version_id
       except select question_number, btrim(instruction), marks from public.word_efficiency_questions where version_id = t.current_version_id)
      union all
      (select question_number, btrim(instruction), marks from public.word_efficiency_questions where version_id = t.current_version_id
       except select question_number, btrim(instruction), marks from public.word_efficiency_questions where version_id = a.version_id)))
 select coalesce((select version_id from own), (select version_id from cur))
$function$;
revoke all on function public.word_efficiency_solution_version(uuid) from public, anon, authenticated;

create or replace function public.word_efficiency_solution_status(p_attempt_id uuid)
returns jsonb language plpgsql stable security definer set search_path to 'pg_catalog', 'public' as $function$
declare a public.word_efficiency_attempts%rowtype; t public.word_efficiency_tests%rowtype;
begin
 select * into a from public.word_efficiency_attempts where id = p_attempt_id;
 if not found or (a.student_id is distinct from auth.uid() and not public.is_aal2_admin()) then return jsonb_build_object('available', false, 'reason', 'not found'); end if;
 select * into t from public.word_efficiency_tests where id = a.test_id;
 if public.word_efficiency_solution_version(p_attempt_id) is null then return jsonb_build_object('available', false, 'reason', 'none'); end if;
 if a.result_published_at is null then return jsonb_build_object('available', false, 'reason', 'result pending'); end if;
 if t.is_live and now() >= t.live_starts_at and now() < t.live_ends_at then return jsonb_build_object('available', false, 'reason', 'live', 'opensAt', t.live_ends_at); end if;
 return jsonb_build_object('available', true);
end $function$;

create or replace function public.get_word_efficiency_solution(p_attempt_id uuid)
returns jsonb language plpgsql stable security definer set search_path to 'pg_catalog', 'public' as $function$
declare status jsonb; a public.word_efficiency_attempts%rowtype; source uuid;
begin
 status := public.word_efficiency_solution_status(p_attempt_id);
 if not coalesce((status->>'available')::boolean, false) then return status; end if;
 select * into a from public.word_efficiency_attempts where id = p_attempt_id;
 source := public.word_efficiency_solution_version(p_attempt_id);
 return status || jsonb_build_object('title', a.snapshot->>'title', 'questions', coalesce((
  select jsonb_agg(jsonb_build_object('number', q.question_number, 'instruction', q.instruction, 'marks', q.marks, 'solution', q.solution, 'image', q.solution_image,
    'awarded', (select s.awarded_marks from public.word_efficiency_question_scores s where s.attempt_id = a.id and s.question_number = q.question_number)) order by q.display_order, q.question_number)
  from public.word_efficiency_questions q where q.version_id = source and q.is_visible), '[]'::jsonb));
end $function$;

revoke all on function public.word_efficiency_solution_status(uuid) from public, anon;
revoke all on function public.get_word_efficiency_solution(uuid) from public, anon;
grant execute on function public.word_efficiency_solution_status(uuid) to authenticated;
grant execute on function public.get_word_efficiency_solution(uuid) to authenticated;

commit;
