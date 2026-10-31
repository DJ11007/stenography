-- Word and Excel Efficiency: the result is shown as soon as a test is submitted, for every test.
-- Until now a result was published only when the test's "automatic publishing" was on AND every question had a
-- grading rule; otherwise the attempt stayed "submitted" and waited for a teacher. Students who took a test again
-- and again got no marks (Hindi EFFICIENCY TEST 1 lost 4 of its rules in an admin save on 2026-10-29, so 26
-- attempts since then are waiting; Hindi TESTS 4-8 have publishing off).
-- Now, on submit:
--   * every question with rules is marked as before;
--   * a question with no rule gets 0 marks, with the note "Not checked automatically" (a teacher can still change it);
--   * the result is published at once, whatever the test's automatic-publishing switch says.
-- Also restores Hindi EFFICIENCY TEST 1's rules for Q7 (header), Q8 (footer), Q9 (page number) and Q15 (orange
-- cell), as written in migration 202610241100, for questions that have no rule now.
-- The functions are changed in place from their live definitions; safe to run twice.
begin;

-- Every piece of text matched below is a single line, and the inserted text has its line breaks as E'\n', so the
-- script works the same whether it is pasted with Windows (CRLF) or Unix (LF) line endings.
do $migration$
declare definition text; word_gate text; word_new text; excel_count text; excel_new text;
begin
  -- Word: the auto-publish gate ("if exists(... auto_publish_results)then / perform ...auto_publish_attempt / end if;")
  word_gate := ' if exists(select 1 from public.word_efficiency_tests as test_rows where test_rows.id=attempt_record.test_id and test_rows.auto_publish_results)then' || E'\n'
            || '  perform public.word_efficiency_auto_publish_attempt(p_attempt_id);' || E'\n'
            || ' end if;';
  word_new := ' update public.word_efficiency_question_scores as question_scores set awarded_marks=0,grading_status=''graded'',teacher_comment=''Not checked automatically: this question has no marking rule yet, so it gets no marks.'',updated_at=now()where question_scores.attempt_id=p_attempt_id and question_scores.awarded_marks is null and question_scores.graded_by is null;' || E'\n'
           || ' perform public.word_efficiency_auto_publish_attempt(p_attempt_id);';
  select pg_get_functiondef('public.submit_word_efficiency_document(uuid,jsonb)'::regprocedure) into definition;
  definition := replace(definition, chr(13), '');
  if position('Not checked automatically' in definition) = 0 then
    if position(word_gate in definition) = 0 then
      raise exception 'submit_word_efficiency_document is not the expected version';
    end if;
    execute replace(definition, word_gate, word_new);
  end if;

  -- Excel
  excel_count := ' select count(*) filter (where awarded_marks is null), coalesce(sum(awarded_marks), 0), sum(maximum_marks) into unmarked, total, maximum from public.excel_efficiency_question_scores where attempt_id = p_attempt_id;';
  excel_new := ' update public.excel_efficiency_question_scores set awarded_marks = 0, grading_status = ''graded'', teacher_comment = ''Not checked automatically: this question has no marking rule yet, so it gets no marks.'', updated_at = now() where attempt_id = p_attempt_id and awarded_marks is null and graded_by is null;' || E'\n' || excel_count;
  select pg_get_functiondef('public.submit_excel_efficiency_document(uuid,jsonb)'::regprocedure) into definition;
  definition := replace(definition, chr(13), '');
  if position('Not checked automatically' in definition) = 0 then
    if position(excel_count in definition) = 0 or position(' if unmarked = 0 and auto then' in definition) = 0 then
      raise exception 'submit_excel_efficiency_document is not the expected version';
    end if;
    definition := replace(definition, excel_count, excel_new);
    execute replace(definition, ' if unmarked = 0 and auto then', ' if unmarked = 0 then');
  end if;
end
$migration$;

-- Hindi EFFICIENCY TEST 1: the four rules lost on 2026-10-29 (only for a question that has no rule now).
insert into public.word_efficiency_grading_rules(version_id,question_id,exact_target,expected_operation,expected_value,allocated_marks,partial_marks,additional_criteria,part_label)
select '69dbc0f2-9055-41d3-a88b-44a65d8f33c5'::uuid,rule.question_id::uuid,'rule','model-answer-match-v2','null'::jsonb,rule.marks,null,rule.criteria::jsonb,rule.part_label
from (values
 ('3542d2c2-d7ee-47e2-96e7-d3738a0fcd49','a',0.83,'[{"rule":"anyOf","criteria":[{"rule":"text","kind":"header","find":"jktLFkku ,y-Mh-lh","props":{"fontFamily":{"regex":"^kruti dev"}}},{"rule":"text","kind":"header","find":"राजस्थान एल.डी.सी"}]},{"rule":"value","target":"blocks.0.alignment","kind":"header","place":0,"spec":["center"]}]'),
 ('3542d2c2-d7ee-47e2-96e7-d3738a0fcd49','b',0.83,'[{"rule":"anyOf","criteria":[{"rule":"text","kind":"header","find":"jktLFkku ,y-Mh-lh","props":{"fontSize":[22],"fontFamily":{"regex":"^kruti dev"}}},{"rule":"text","kind":"header","find":"राजस्थान एल.डी.सी","props":{"fontSize":[22]}}]}]'),
 ('e10c2f52-730c-4a62-8bec-5c4045ddd41a','a',0.83,'[{"rule":"anyOf","criteria":[{"rule":"text","kind":"footer","find":"vf/kuLFk cksMZ","props":{"fontSize":[22],"fontFamily":{"regex":"^kruti dev"}}},{"rule":"text","kind":"footer","find":"अधिनस्थ बोर्ड","props":{"fontSize":[22]}},{"rule":"text","kind":"footer","find":"अधीनस्थ बोर्ड","props":{"fontSize":[22]}}]}]'),
 ('e10c2f52-730c-4a62-8bec-5c4045ddd41a','b',0.83,'[{"rule":"anyOf","criteria":[{"rule":"text","kind":"footer","find":"\t\tvf/kuLFk cksMZ"},{"rule":"text","kind":"footer","find":"\t\tअधिनस्थ बोर्ड"},{"rule":"text","kind":"footer","find":"\t\tअधीनस्थ बोर्ड"},{"rule":"value","target":"blocks.0.alignment","kind":"footer","place":0,"spec":["right"]}]}]'),
 ('3c017160-9992-43fa-8509-20647861df7b','a',0.83,'[{"rule":"run","kind":"footer","props":{"field":{"regex":"^page-number\\|[a-z]+\\|left$"}}}]'),
 ('3c017160-9992-43fa-8509-20647861df7b','b',0.83,'[{"rule":"run","kind":"footer","props":{"field":{"regex":"^page-number\\|"},"text":{"regex":"^\\s*4\\s*$"}}}]'),
 ('4be81f9d-d9bb-4646-ba0e-e3fdf558af3c',null,1.76,'[{"rule":"anyOf","criteria":[{"rule":"table","place":0,"onlyRow":2,"onlyColumn":2,"cellProps":{"shading":{"regex":"^(FFC000|ED7D31|FFA500|FF8C00|F4B183|C55A11|F8CBAD)$"}}},{"rule":"table","place":0,"rowCount":11,"onlyRow":10,"onlyColumn":2,"cellProps":{"shading":{"regex":"^(FFC000|ED7D31|FFA500|FF8C00|F4B183|C55A11|F8CBAD)$"}}}]}]')
) as rule(question_id,part_label,marks,criteria)
where exists(select 1 from public.word_efficiency_questions q where q.id=rule.question_id::uuid and q.version_id='69dbc0f2-9055-41d3-a88b-44a65d8f33c5')
  and not exists(select 1 from public.word_efficiency_grading_rules r where r.version_id='69dbc0f2-9055-41d3-a88b-44a65d8f33c5' and r.question_id=rule.question_id::uuid);

commit;
