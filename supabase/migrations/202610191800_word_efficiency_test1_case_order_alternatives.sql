-- EFFICIENCY TEST 1 (version 8474e3be): Q3 (Capitalize Each Word) and Q11 (tOGGLE cASE) only accepted
-- one order of work relative to Q6 (Replace "the" with "SAMRADHI CLASSES"). Word's Change Case also
-- re-cases the inserted text, so:
--   Q3 done AFTER Q6  -> "... Reviewed Samradhi Classes New Water ..." (was 0 marks; only the
--                        Q3-before-Q6 text "SAMRADHI CLASSES" was accepted)
--   Q11 done BEFORE Q6 -> "... ORGANISED SAMRADHI CLASSES WINTER ..." (only the toggle-after-replace
--                        text "samradhi classes" was accepted)
-- Both are correct work, so each order is now an accepted alternative. Only adds alternatives.
begin;

update public.word_efficiency_grading_rules r
set additional_criteria = jsonb_set(
  r.additional_criteria, '{0,alternatives}',
  (r.additional_criteria->0->'alternatives') || to_jsonb(replace(r.additional_criteria->0->>'expectedValue', 'SAMRADHI CLASSES', 'Samradhi Classes')))
where r.id = '79ba4fc3-c906-43ec-b6b1-1a96a36e4e67'
  and not (r.additional_criteria->0->'alternatives') ? replace(r.additional_criteria->0->>'expectedValue', 'SAMRADHI CLASSES', 'Samradhi Classes');

update public.word_efficiency_grading_rules r
set additional_criteria = jsonb_set(
  r.additional_criteria, '{0,alternatives}',
  (r.additional_criteria->0->'alternatives') || to_jsonb(replace(r.additional_criteria->0->>'expectedValue', 'samradhi classes', 'SAMRADHI CLASSES')))
where r.id = 'f9c4c014-a36e-4237-bfc9-b4b30ec48f95'
  and not (r.additional_criteria->0->'alternatives') ? replace(r.additional_criteria->0->>'expectedValue', 'samradhi classes', 'SAMRADHI CLASSES');

commit;
