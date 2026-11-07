-- Excel efficiency marking, as the Word one (202611071000): no marks for questions a student never attempted, and no
-- part or cell marks inside a question.
--
-- 1. excel_efficiency_score_question now ignores any check the untouched starting sheet already meets, and gives a
--    question its full marks only when every check of that question is met -- otherwise 0.
-- 2. English EXCEL EFFICIENCY TEST 3 (version 5, 8f59bf4c): its checks were rebuilt from the model answer and landed
--    on the wrong questions (Q4 and Q5 re-checked A55-A57; Q7, Q8 and Q10 all held the same 26 cell values; Q6 and Q9
--    had no check at all, so nobody could score them). Written again from the questions; the values of Q7 (D55:I59)
--    and Q11 (K2:K54) are the model answer's computed results. Marked 'hand-written' so the Model Answer page keeps
--    them when a question is solved again.
-- 3. Every finished attempt of that version is marked again (scores are fixed at submission).
begin;

create or replace function public.excel_efficiency_rule_passes(p_doc jsonb, r public.excel_efficiency_grading_rules)
returns boolean
language plpgsql
stable
set search_path to 'pg_catalog', 'public'
as $f$
declare item jsonb;
begin
  if p_doc is null then return false; end if;
  if r.expected_operation = 'rule-criteria' then
    if jsonb_array_length(coalesce(r.additional_criteria, '[]'::jsonb)) = 0 then return false; end if;
    for item in select value from jsonb_array_elements(r.additional_criteria) loop
      if not coalesce(public.excel_efficiency_criterion_matches(p_doc, item), false) then return false; end if;
    end loop;
    return true;
  end if;
  return coalesce(public.evaluate_excel_grading_rule(p_doc, r.exact_target, r.expected_operation, r.expected_value, r.allocated_marks, r.partial_marks), 0) >= r.allocated_marks - 0.005;
end $f$;

create or replace function public.excel_efficiency_score_question(p_doc jsonb, p_version uuid, p_question uuid, p_max numeric)
returns numeric
language plpgsql
stable
set search_path to 'pg_catalog', 'public'
as $function$
declare r public.excel_efficiency_grading_rules; start_doc jsonb; counted integer := 0; all_done boolean := true;
begin
  select working_matter_snapshot into start_doc from public.excel_efficiency_versions where id = p_version;
  for r in select * from public.excel_efficiency_grading_rules where version_id = p_version and question_id = p_question loop
    -- A check the untouched sheet already meets says nothing about what the student did: it gives nothing.
    begin
      if public.excel_efficiency_rule_passes(start_doc, r) then continue; end if;
    exception when others then null;
    end;
    counted := counted + 1;
    if not public.excel_efficiency_rule_passes(p_doc, r) then all_done := false; end if;
  end loop;
  -- The whole question, or nothing.
  return case when counted > 0 and all_done then p_max else 0 end;
end $function$;

-- English EXCEL EFFICIENCY TEST 3, version 5
delete from public.excel_efficiency_grading_rules
where version_id = '8f59bf4c-117a-4b87-ac19-19dc6b2125bc'
  and exists (select 1 from public.excel_efficiency_versions where id = '8f59bf4c-117a-4b87-ac19-19dc6b2125bc' and model_answer_snapshot is not null);

insert into public.excel_efficiency_grading_rules (version_id, question_id, exact_target, expected_operation, expected_value, allocated_marks, partial_marks, additional_criteria, part_label)
select '8f59bf4c-117a-4b87-ac19-19dc6b2125bc', q.id, 'hand-written', 'rule-criteria', 'null'::jsonb, q.marks, null, r.criteria, null
from (
  select 1 as question_number, '[{"rule":"value","cell":"A55","equals":"Total of district"}]'::jsonb as criteria
  union all select 2, '[{"rule":"value","cell":"A56","equals":"Minimum in district"}]'
  union all select 3, '[{"rule":"value","cell":"A57","equals":"Maximum in district"}]'
  union all select 4, '[{"rule":"value","cell":"A58","equals":"Average of district"}]'
  union all select 5, '[{"rule":"value","cell":"A59","equals":"sales count"}]'
  -- Blue, Accent 5, Lighter 40% (Excel 2013 8EAADB; newer Excel 8FAADC)
  union all select 6, '[{"rule":"cells","range":"A55:A59","props":{"fontColor":["8EAADB","8FAADC"]}}]'
  -- Total / Minimum / Maximum / Average / Count of D2:I54 in D55:I59
  union all select 7, (select jsonb_agg(jsonb_build_object('rule', 'value', 'cell', k, 'equals', (c->>'value')::numeric) order by k)
                       from public.excel_efficiency_versions v, jsonb_each(v.model_answer_snapshot->'cells') e(k, c)
                       where v.id = '8f59bf4c-117a-4b87-ac19-19dc6b2125bc' and k ~ '^[D-I]5[5-9]$' and c->>'value' ~ '^-?[0-9]+(\.[0-9]+)?$')
  union all select 8, '[{"rule":"sheet","path":"freeze","equals":"B2"}]'
  union all select 9, '[{"rule":"cells","range":"A1:L60","props":{"align":["left"]}},{"rule":"sheet","path":"printArea","in":["A1:L60"]}]'
  union all select 10, '[{"rule":"cells","range":"A62:K65","props":{"fillColor":["FFFF00"],"vAlign":["middle"]}},{"rule":"sheet","path":"hiddenRows","includesAll":[62,63,64,65]}]'
  -- each candidate's salary in K2:K54
  union all select 11, (select jsonb_agg(jsonb_build_object('rule', 'value', 'cell', k, 'equals', (c->>'value')::numeric) order by k)
                        from public.excel_efficiency_versions v, jsonb_each(v.model_answer_snapshot->'cells') e(k, c)
                        where v.id = '8f59bf4c-117a-4b87-ac19-19dc6b2125bc' and k ~ '^K([2-9]|[1-4][0-9]|5[0-4])$' and c->>'value' ~ '^-?[0-9]+(\.[0-9]+)?$')
  union all select 12, '[{"rule":"sheet","path":"name","equals":"LDC 2026"}]'
  union all select 13, '[{"rule":"sheet","path":"tabColor","equals":["FF0000","C00000"]}]'
  union all select 14, '[{"rule":"sheet","path":"header.left","contains":"&[File]"},{"rule":"sheet","path":"header.center","contains":"SAMRADHI CLASSES"}]'
  union all select 15, '[{"rule":"sheet","path":"footer.left","contains":"&[Date]"},{"rule":"sheet","path":"footer.left","contains":"&[Time]"},{"rule":"sheet","path":"footer.center","contains":"&[Tab]"},{"rule":"sheet","path":"footer.right","contains":"&[Page]"}]'
) as r
join public.excel_efficiency_questions q on q.version_id = '8f59bf4c-117a-4b87-ac19-19dc6b2125bc' and q.question_number = r.question_number
where r.criteria is not null;

create temporary table remarked (student text, old_marks numeric, new_marks numeric) on commit drop;

do $$
declare
  v_version constant uuid := '8f59bf4c-117a-4b87-ac19-19dc6b2125bc';
  a record; q record; earned numeric; total numeric; maximum numeric; passing numeric;
begin
  select passing_marks into passing from public.excel_efficiency_versions where id = v_version;
  for a in select w.id, w.final_document_snapshot doc, w.result, coalesce(p.full_name, w.student_id::text) name
           from public.excel_efficiency_attempts w left join public.profiles p on p.id = w.student_id
           where w.version_id = v_version and w.final_document_snapshot is not null loop
    for q in select s.id, s.question_id, s.maximum_marks from public.excel_efficiency_question_scores s
             where s.attempt_id = a.id and s.graded_by is null loop
      earned := coalesce(public.excel_efficiency_score_question(a.doc, v_version, q.question_id, q.maximum_marks), 0);
      update public.excel_efficiency_question_scores
         set awarded_marks = earned, grading_status = 'graded',
             teacher_comment = case when earned >= q.maximum_marks then 'Full marks: the required change was found in your sheet.'
                                    else 'No marks: the question was not done as asked.' end,
             updated_at = now()
       where id = q.id;
    end loop;
    select coalesce(sum(awarded_marks), 0), sum(maximum_marks) into total, maximum from public.excel_efficiency_question_scores where attempt_id = a.id;
    if a.result ? 'marks' then
      update public.excel_efficiency_attempts set result = coalesce(result, '{}'::jsonb) || jsonb_build_object('marks', total, 'maximum_marks', maximum,
          'percentage', case when maximum > 0 then round(total * 100 / maximum, 2) else 0 end,
          'passed', case when passing is null then null else total >= passing end), updated_at = now()
        where id = a.id;
      update public.live_exam_section_attempts l set marks = least(total, ls.max_marks)
        from public.live_exam_sections ls where ls.id = l.section_id and l.attempt_id = a.id;
    end if;
    insert into remarked values (a.name, nullif(a.result->>'marks', '')::numeric, total);
  end loop;
end $$;

select student, old_marks, new_marks from remarked order by student;

commit;
