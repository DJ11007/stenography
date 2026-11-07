-- Word and Excel marking: a question written in sections -- a) ... b) ... c) ... -- gets each section's share of its
-- marks for that section done as asked (the admin, 7 Nov: "this question is designed in a) b) c) section so every
-- section wise number should be given"). E.g. English Word TEST 2 Q1: A5 page size alone gives (a) 1.67 of 5.
--
-- A question is marked by section when its wording has at least two a)/b)/c) markers and its checks are split into
-- no more parts than that (part_label a, b, c...). Otherwise it stays whole-question (202611071000 / 202611071100):
-- full marks only when everything is done. That keeps checks auto-built one per cell (Excel TEST 2 Q7-Q9: 7-25
-- "parts", no sections in the wording) from splitting a question's marks again.
-- Inside a section nothing changes: the section counts only when all of its checks are met, and a check the
-- untouched starting document already meets gives nothing.
-- The finished attempts of the current versions are marked again for the questions this applies to.
begin;

create or replace function public.efficiency_instruction_sections(p_instruction text)
returns integer
language sql
immutable
set search_path to 'pg_catalog', 'public'
as $$ select count(*)::integer from regexp_matches(coalesce(p_instruction, ''), '(^|[\s(])[a-hA-H]\)', 'g') $$;

create or replace function public.word_efficiency_score_question(p_document jsonb, p_version_id uuid, p_question_id uuid, p_maximum numeric, p_model jsonb, out awarded numeric, out parts jsonb)
returns record
language plpgsql
stable security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  rule record; part record; earned numeric; start_earned numeric;
  words_document jsonb; start_document jsonb; start_words jsonb;
  counted integer := 0; all_done boolean := true;
  sectioned boolean; part_count integer; part_done boolean; part_counted boolean;
  counted_marks numeric := 0; done_marks numeric := 0;
begin
  awarded := null; parts := null;
  if not exists (select 1 from public.word_efficiency_grading_rules g where g.version_id = p_version_id and g.question_id = p_question_id) then
    return;
  end if;
  words_document := public.word_efficiency_merge_word_runs(p_document);
  begin
    select public.word_efficiency_initial_editor_document(v.working_matter_snapshot) into start_document
      from public.word_efficiency_versions v where v.id = p_version_id;
    start_words := public.word_efficiency_merge_word_runs(start_document);
  exception when others then
    start_document := null; start_words := null;
  end;
  select count(distinct g.part_label) into part_count from public.word_efficiency_grading_rules g
   where g.version_id = p_version_id and g.question_id = p_question_id and g.part_label is not null;
  select part_count >= 2 and part_count <= public.efficiency_instruction_sections(q.instruction)
    into sectioned from public.word_efficiency_questions q where q.id = p_question_id;
  sectioned := coalesce(sectioned, false);

  if sectioned then
    parts := '[]'::jsonb;
    for part in select g.part_label, sum(g.allocated_marks) as marks from public.word_efficiency_grading_rules g
                 where g.version_id = p_version_id and g.question_id = p_question_id and g.part_label is not null
                 group by g.part_label order by g.part_label loop
      part_done := true; part_counted := false;
      for rule in select g.* from public.word_efficiency_grading_rules g
                  where g.version_id = p_version_id and g.question_id = p_question_id and g.part_label = part.part_label
                  order by g.created_at, g.id loop
        if start_document is not null then
          start_earned := greatest(
            coalesce(public.evaluate_word_efficiency_grading_rule(start_document, rule.exact_target, rule.expected_operation, rule.expected_value, rule.allocated_marks, rule.partial_marks, rule.additional_criteria, p_model), 0),
            coalesce(public.evaluate_word_efficiency_grading_rule(start_words, rule.exact_target, rule.expected_operation, rule.expected_value, rule.allocated_marks, rule.partial_marks, rule.additional_criteria, p_model), 0));
          if start_earned >= rule.allocated_marks - 0.005 then continue; end if;
        end if;
        part_counted := true;
        earned := greatest(
          coalesce(public.evaluate_word_efficiency_grading_rule(p_document, rule.exact_target, rule.expected_operation, rule.expected_value, rule.allocated_marks, rule.partial_marks, rule.additional_criteria, p_model), 0),
          coalesce(public.evaluate_word_efficiency_grading_rule(words_document, rule.exact_target, rule.expected_operation, rule.expected_value, rule.allocated_marks, rule.partial_marks, rule.additional_criteria, p_model), 0));
        if earned < rule.allocated_marks - 0.005 then part_done := false; end if;
      end loop;
      if part_counted then
        counted_marks := counted_marks + part.marks;
        if part_done then done_marks := done_marks + part.marks; end if;
      end if;
      parts := parts || jsonb_build_object('label', part.part_label, 'awarded', case when part_counted and part_done then part.marks else 0 end, 'maximum', part.marks);
    end loop;
    awarded := case when counted_marks > 0 then round(done_marks * p_maximum / counted_marks, 2) else 0 end;
    return;
  end if;

  for rule in select g.* from public.word_efficiency_grading_rules g
              where g.version_id = p_version_id and g.question_id = p_question_id
              order by coalesce(g.part_label, ''), g.created_at, g.id loop
    -- A check the untouched document already meets says nothing about what the student did: it gives nothing.
    if start_document is not null then
      start_earned := greatest(
        coalesce(public.evaluate_word_efficiency_grading_rule(start_document, rule.exact_target, rule.expected_operation, rule.expected_value, rule.allocated_marks, rule.partial_marks, rule.additional_criteria, p_model), 0),
        coalesce(public.evaluate_word_efficiency_grading_rule(start_words, rule.exact_target, rule.expected_operation, rule.expected_value, rule.allocated_marks, rule.partial_marks, rule.additional_criteria, p_model), 0));
      if start_earned >= rule.allocated_marks - 0.005 then continue; end if;
    end if;
    counted := counted + 1;
    earned := greatest(
      coalesce(public.evaluate_word_efficiency_grading_rule(p_document, rule.exact_target, rule.expected_operation, rule.expected_value, rule.allocated_marks, rule.partial_marks, rule.additional_criteria, p_model), 0),
      coalesce(public.evaluate_word_efficiency_grading_rule(words_document, rule.exact_target, rule.expected_operation, rule.expected_value, rule.allocated_marks, rule.partial_marks, rule.additional_criteria, p_model), 0));
    if earned < rule.allocated_marks - 0.005 then all_done := false; end if;
  end loop;
  -- The whole question, or nothing.
  awarded := case when counted > 0 and all_done then p_maximum else 0 end;
end $function$;

create or replace function public.excel_efficiency_score_question(p_doc jsonb, p_version uuid, p_question uuid, p_max numeric)
returns numeric
language plpgsql
stable
set search_path to 'pg_catalog', 'public'
as $function$
declare
  r public.excel_efficiency_grading_rules; part record; start_doc jsonb; counted integer := 0; all_done boolean := true;
  sectioned boolean; part_count integer; part_done boolean; part_counted boolean; counted_marks numeric := 0; done_marks numeric := 0; trivial boolean;
begin
  select working_matter_snapshot into start_doc from public.excel_efficiency_versions where id = p_version;
  select count(distinct g.part_label) into part_count from public.excel_efficiency_grading_rules g
   where g.version_id = p_version and g.question_id = p_question and g.part_label is not null;
  select part_count >= 2 and part_count <= public.efficiency_instruction_sections(q.instruction)
    into sectioned from public.excel_efficiency_questions q where q.id = p_question;

  if coalesce(sectioned, false) then
    for part in select g.part_label, sum(g.allocated_marks) as marks from public.excel_efficiency_grading_rules g
                 where g.version_id = p_version and g.question_id = p_question and g.part_label is not null
                 group by g.part_label loop
      part_done := true; part_counted := false;
      for r in select * from public.excel_efficiency_grading_rules g
               where g.version_id = p_version and g.question_id = p_question and g.part_label = part.part_label loop
        trivial := false;
        begin trivial := public.excel_efficiency_rule_passes(start_doc, r); exception when others then trivial := false; end;
        continue when trivial;
        part_counted := true;
        if not public.excel_efficiency_rule_passes(p_doc, r) then part_done := false; end if;
      end loop;
      if part_counted then
        counted_marks := counted_marks + part.marks;
        if part_done then done_marks := done_marks + part.marks; end if;
      end if;
    end loop;
    return case when counted_marks > 0 then round(done_marks * p_max / counted_marks, 2) else 0 end;
  end if;

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

create temporary table remarked (subject text, test text, student text, old_marks numeric, new_marks numeric) on commit drop;

-- Word: current versions, questions marked by section.
do $$
declare v record; a record; q record; earned numeric; got_parts jsonb; total numeric; maximum numeric; changed boolean;
begin
  for v in select distinct on (ver.test_id) ver.id, ver.model_answer_snapshot model, ver.passing_marks passing, t.language || ' ' || t.title as test
             from public.word_efficiency_versions ver join public.word_efficiency_tests t on t.id = ver.test_id
            order by ver.test_id, ver.version_number desc loop
    continue when not exists (
      select 1 from public.word_efficiency_questions x
       where x.version_id = v.id
         and (select count(distinct g.part_label) from public.word_efficiency_grading_rules g where g.question_id = x.id and g.version_id = v.id and g.part_label is not null)
             between 2 and public.efficiency_instruction_sections(x.instruction));
    for a in select w.id, w.final_document_snapshot doc, w.result, coalesce(p.full_name, w.student_id::text) name
               from public.word_efficiency_attempts w left join public.profiles p on p.id = w.student_id
              where w.version_id = v.id and w.final_document_snapshot is not null loop
      changed := false;
      for q in select s.id, s.question_id, s.maximum_marks, s.awarded_marks from public.word_efficiency_question_scores s
                 join public.word_efficiency_questions x on x.id = s.question_id
                where s.attempt_id = a.id and s.graded_by is null
                  and (select count(distinct g.part_label) from public.word_efficiency_grading_rules g where g.question_id = x.id and g.version_id = v.id and g.part_label is not null)
                      between 2 and public.efficiency_instruction_sections(x.instruction) loop
        select scored.awarded, scored.parts into earned, got_parts
          from public.word_efficiency_score_question(a.doc, v.id, q.question_id, q.maximum_marks, v.model) as scored;
        earned := coalesce(earned, 0);
        if earned is distinct from q.awarded_marks then changed := true; end if;
        update public.word_efficiency_question_scores set awarded_marks = earned, part_scores = got_parts, grading_status = 'graded',
          teacher_comment = case when earned >= q.maximum_marks then 'Full marks: the required change was found in your document.'
                                 when earned <= 0 then 'No marks: the question was not done as asked.'
                                 else 'Part marks: the sections done as asked got their marks; the others did not.' end,
          updated_at = now()
        where id = q.id;
      end loop;
      if changed then
        select coalesce(sum(awarded_marks), 0), sum(maximum_marks) into total, maximum from public.word_efficiency_question_scores where attempt_id = a.id;
        if a.result ? 'marks' then
          update public.word_efficiency_attempts set result = coalesce(result, '{}'::jsonb) || jsonb_build_object('marks', total, 'maximum_marks', maximum,
              'percentage', case when maximum > 0 then round(total * 100 / maximum, 2) else 0 end,
              'passed', case when v.passing is null then null else total >= v.passing end), updated_at = now()
            where id = a.id;
          update public.live_exam_section_attempts l set marks = least(total, ls.max_marks)
            from public.live_exam_sections ls where ls.id = l.section_id and l.attempt_id = a.id;
        end if;
        insert into remarked values ('Word', v.test, a.name, nullif(a.result->>'marks', '')::numeric, total);
      end if;
    end loop;
  end loop;
end $$;

-- Excel: current versions, questions marked by section.
do $$
declare v record; a record; q record; earned numeric; total numeric; maximum numeric; changed boolean;
begin
  for v in select distinct on (ver.test_id) ver.id, ver.passing_marks passing, t.language || ' ' || t.title as test
             from public.excel_efficiency_versions ver join public.excel_efficiency_tests t on t.id = ver.test_id
            order by ver.test_id, ver.version_number desc loop
    continue when not exists (
      select 1 from public.excel_efficiency_questions x
       where x.version_id = v.id
         and (select count(distinct g.part_label) from public.excel_efficiency_grading_rules g where g.question_id = x.id and g.version_id = v.id and g.part_label is not null)
             between 2 and public.efficiency_instruction_sections(x.instruction));
    for a in select w.id, w.final_document_snapshot doc, w.result, coalesce(p.full_name, w.student_id::text) name
               from public.excel_efficiency_attempts w left join public.profiles p on p.id = w.student_id
              where w.version_id = v.id and w.final_document_snapshot is not null loop
      changed := false;
      for q in select s.id, s.question_id, s.maximum_marks, s.awarded_marks from public.excel_efficiency_question_scores s
                 join public.excel_efficiency_questions x on x.id = s.question_id
                where s.attempt_id = a.id and s.graded_by is null
                  and (select count(distinct g.part_label) from public.excel_efficiency_grading_rules g where g.question_id = x.id and g.version_id = v.id and g.part_label is not null)
                      between 2 and public.efficiency_instruction_sections(x.instruction) loop
        earned := coalesce(public.excel_efficiency_score_question(a.doc, v.id, q.question_id, q.maximum_marks), 0);
        if earned is distinct from q.awarded_marks then changed := true; end if;
        update public.excel_efficiency_question_scores set awarded_marks = earned, grading_status = 'graded',
          teacher_comment = case when earned >= q.maximum_marks then 'Full marks: the required change was found in your sheet.'
                                 when earned <= 0 then 'No marks: the question was not done as asked.'
                                 else 'Part marks: the sections done as asked got their marks; the others did not.' end,
          updated_at = now()
        where id = q.id;
      end loop;
      if changed then
        select coalesce(sum(awarded_marks), 0), sum(maximum_marks) into total, maximum from public.excel_efficiency_question_scores where attempt_id = a.id;
        if a.result ? 'marks' then
          update public.excel_efficiency_attempts set result = coalesce(result, '{}'::jsonb) || jsonb_build_object('marks', total, 'maximum_marks', maximum,
              'percentage', case when maximum > 0 then round(total * 100 / maximum, 2) else 0 end,
              'passed', case when v.passing is null then null else total >= v.passing end), updated_at = now()
            where id = a.id;
          update public.live_exam_section_attempts l set marks = least(total, ls.max_marks)
            from public.live_exam_sections ls where ls.id = l.section_id and l.attempt_id = a.id;
        end if;
        insert into remarked values ('Excel', v.test, a.name, nullif(a.result->>'marks', '')::numeric, total);
      end if;
    end loop;
  end loop;
end $$;

select subject, test, student, old_marks, new_marks from remarked order by subject, test, student;

commit;
