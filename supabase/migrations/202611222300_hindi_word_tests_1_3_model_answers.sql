-- Hindi Word Efficiency Tests 1, 2 and 3 (22 Nov 2026): the saved model answers did not score full marks against the
-- papers' own marking rules (Test 1: 23.34, Test 2: 13.28, Test 3: 23.34 of 25) -- the model answers were unfinished,
-- the rules were right (students get full marks on every one of those questions). Each model answer is replaced by a
-- submitted paper that scores 25/25. Checked before applying: over all 397 completed attempts of the three papers, no
-- question score differs between the old and the new model answer, and the untouched paper still scores 0.
update public.word_efficiency_versions v set model_answer_snapshot = a.final_document_snapshot
from public.word_efficiency_tests t, public.word_efficiency_attempts a,
 (values ('EFFICIENCY TEST 1', 'd0815031-62be-4f29-ab9f-d5f219aec46e'::uuid),
         ('EFFICIENCY TEST 2', '577333db-cb21-43ea-901c-174bd9f19041'::uuid),
         ('EFFICIENCY TEST 3', '08244f48-3771-46a6-a3ad-ec0b16783a85'::uuid)) as pick(title, attempt)
where t.language = 'Hindi' and t.title = pick.title and v.id = t.current_version_id
  and a.id = pick.attempt and a.test_id = t.id and a.version_id = v.id and a.final_document_snapshot is not null;
