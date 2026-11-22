-- Word Efficiency marking fixes found in Live Exam 10 (22 Nov 2026), Hindi Word Test 5:
-- 1. Table headings (headerAt / columnHeader) are compared with non-breaking spaces read as spaces, runs of spaces
--    as one, and the ends trimmed. A space typed at the end of a cell is saved as a non-breaking space (U+00A0),
--    which btrim kept, so a correctly typed heading such as "fon~;kFkhZ dk uke " failed. Over 1,291 heading checks
--    on 30 days of attempts: none newly fails, 36 newly pass (16 attempts).
-- 2. Test 5 Q1 also accepts "dze la[;k" -- the same क्रम संख्या typed with d+z for क्र in Kruti Dev 010.
-- 3. Test 5 Q7 (page number from 2, bold, centre) also accepts the number at the centre tab stop: one Tab in the
--    footer, then Page Number > Current Position, saved as "\t2" (the field may be named left/right/current).
do $$ declare d text;
 old1 text := 'if lower(btrim(coalesce(rows_value->0->>((item->>0)::integer),'''')))<>lower(btrim(item->>1)) then return false;end if;';
 new1 text := 'if lower(btrim(regexp_replace(replace(coalesce(rows_value->0->>((item->>0)::integer),''''),chr(160),'' ''),''\s+'','' '',''g'')))<>lower(btrim(regexp_replace(replace(item->>1,chr(160),'' ''),''\s+'','' '',''g''))) then return false;end if;';
 old2 text := 'where lower(btrim(head.value#>>''{}''))=lower(btrim(criterion->>''columnHeader''))';
 new2 text := 'where lower(btrim(regexp_replace(replace(head.value#>>''{}'',chr(160),'' ''),''\s+'','' '',''g'')))=lower(btrim(regexp_replace(replace(criterion->>''columnHeader'',chr(160),'' ''),''\s+'','' '',''g'')))';
begin
 d := pg_get_functiondef('public.word_efficiency_rule_criterion_matches'::regproc);
 if position(new1 in d) = 0 then
  if position(old1 in d)=0 or position(old2 in d)=0 then raise exception 'header anchors missing'; end if;
  execute replace(replace(d, old1, new1), old2, new2);
 end if;
end $$;
drop function if exists public.zz_wrcm(jsonb, jsonb);

-- Test 5 Q1: column 1 alternative.
update public.word_efficiency_grading_rules g set additional_criteria = jsonb_set(g.additional_criteria, '{0,criteria}',
  (g.additional_criteria->0->'criteria') || '[{"rule":"table","place":0,"headerAt":{"0":"dze la[;k"}}]'::jsonb)
from public.word_efficiency_questions q, public.word_efficiency_tests t
where g.question_id=q.id and q.version_id=t.current_version_id and t.id='79908fc6-ffae-4651-add2-d47507036b02' and q.question_number=1
  and g.additional_criteria->0->>'rule'='anyOf' and position('dze la[;k' in g.additional_criteria::text)=0;

-- Test 5 Q7: the page number at the centre tab stop.
update public.word_efficiency_grading_rules g set additional_criteria = jsonb_build_array(jsonb_build_object('rule','anyOf','criteria',
  jsonb_build_array(g.additional_criteria->0, '{"kind":"footer","rule":"run","props":{"bold":[true],"text":{"regex":"^\\t\\s*2\\s*$"},"field":{"regex":"^page-number\\|"}}}'::jsonb)))
from public.word_efficiency_questions q, public.word_efficiency_tests t
where g.question_id=q.id and q.version_id=t.current_version_id and t.id='79908fc6-ffae-4651-add2-d47507036b02' and q.question_number=7
  and g.additional_criteria->0->>'rule'='run' and jsonb_array_length(g.additional_criteria)=1;
