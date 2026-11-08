-- Hindi Word tests, admin's attempt of 7 Nov:
--   TEST 4 Q14 (page number 4 on the right of the footer): a number put on the right with Page Number > Current Position
--     after two tabs was recorded as "left" (editor fixed in the same commit), so the right answer got 0. A page number
--     that starts after a tab now counts as well. Attempts of the current version are marked again for Q14 only.
--   TEST 5 Q6: "ड्रॉप कैप इन लाईन" -> "इन मार्जिन (In margin)", and the check now asks for In margin.
--   TEST 5 Q8: the question did not say where in the header: now "बीच में (Center)", and the check asks for it.
--     Submitted Test 5 attempts are NOT marked again (the questions changed after they were answered).
-- Safe to run twice.
begin;

update public.word_efficiency_grading_rules r
   set additional_criteria = '[{"rule":"anyOf","criteria":[{"rule":"run","kind":"footer","props":{"field":{"regex":"^page-number\\|.*\\|right$"},"text":{"regex":"^\\s*4\\s*$"}}},{"rule":"run","kind":"footer","props":{"field":{"regex":"^page-number\\|current\\|"},"text":{"regex":"^\\t+\\s*4\\s*$"}}}]}]'::jsonb
  from public.word_efficiency_questions q join public.word_efficiency_tests t on t.current_version_id = q.version_id
 where t.language = 'Hindi' and t.title = 'EFFICIENCY TEST 4' and q.question_number = 14 and r.question_id = q.id;

update public.word_efficiency_questions q
   set instruction = 'प्रथम पैराग्राफ के पहले शब्द पर ड्रॉप कैप इन मार्जिन (In margin) दिजिए, जो 4 लाइनों तक फैला हो।',
       solution = E'1. पहले पैराग्राफ में क्लिक करें।\n2. INSERT → **Drop Cap ▾** → **Drop Cap Options…** → Position **In margin**, Lines to drop **4** → **OK**।\n\nजाँच: पहले पैराग्राफ का पहला अक्षर बाएँ मार्जिन में, 4 लाइन जितना बड़ा।'
  from public.word_efficiency_tests t
 where t.language = 'Hindi' and t.title = 'EFFICIENCY TEST 5' and q.version_id = t.current_version_id and q.question_number = 6;
update public.word_efficiency_grading_rules r
   set additional_criteria = '[{"rule":"value","kind":"body","place":0,"target":"blocks.0.attrs.dropCap","spec":[true]},{"rule":"value","kind":"body","place":0,"target":"blocks.0.attrs.dropCapLines","spec":[4]},{"rule":"value","kind":"body","place":0,"target":"blocks.0.attrs.dropCapMargin","spec":[true]}]'::jsonb
  from public.word_efficiency_questions q join public.word_efficiency_tests t on t.current_version_id = q.version_id
 where t.language = 'Hindi' and t.title = 'EFFICIENCY TEST 5' and q.question_number = 6 and r.question_id = q.id;

update public.word_efficiency_questions q
   set instruction = 'पेज के हेडर में बीच में (Center) “अधिनस्थ बोर्ड - 2026” टेक्स्ट, साईज 15, कलर रैड, बोल्ड, डबल अंडरलाईन दिजिए।',
       solution = E'1. INSERT → **Header ▾** → **Edit Header**।\n2. HOME → **Center** (Ctrl+E) (या एक बार Tab दबाकर बीच की जगह पर जाएँ)।\n3. टाइप करें **अधिनस्थ बोर्ड - 2026** (Kruti Dev 010 में "vf/kuLFk cksMZ & 2026")।\n4. पूरा टेक्स्ट सेलेक्ट करें → Font Size **15**, Font Color **Red**, **Bold**, **Underline ▾ → Double underline**।\n5. **Close Header and Footer**।\n\nजाँच: हेडर के बीच में "अधिनस्थ बोर्ड - 2026" साइज 15, लाल, बोल्ड, डबल अंडरलाइन।'
  from public.word_efficiency_tests t
 where t.language = 'Hindi' and t.title = 'EFFICIENCY TEST 5' and q.version_id = t.current_version_id and q.question_number = 8;
update public.word_efficiency_grading_rules r
   set additional_criteria = r.additional_criteria || '[{"rule":"anyOf","criteria":[{"rule":"value","kind":"header","place":0,"target":"blocks.0.alignment","spec":["center"]},{"rule":"run","kind":"header","props":{"text":{"regex":"^\\t"}}}]}]'::jsonb
  from public.word_efficiency_questions q join public.word_efficiency_tests t on t.current_version_id = q.version_id
 where t.language = 'Hindi' and t.title = 'EFFICIENCY TEST 5' and q.question_number = 8 and r.question_id = q.id
   and r.additional_criteria::text not like '%blocks.0.alignment%';

-- Test 4: mark Q14 again on submitted attempts of the current version (not marks a teacher gave by hand).
create temporary table t4_remarked (student text, old_marks numeric, new_marks numeric) on commit drop;
do $$
declare v record; a record; s record; scored record; total numeric; maximum numeric;
begin
  select ver.id, ver.passing_marks, ver.model_answer_snapshot into v
    from public.word_efficiency_tests t join public.word_efficiency_versions ver on ver.id = t.current_version_id
   where t.language = 'Hindi' and t.title = 'EFFICIENCY TEST 4';
  for a in select w.id, w.final_document_snapshot doc, w.result, coalesce(p.full_name, w.student_id::text) name
             from public.word_efficiency_attempts w left join public.profiles p on p.id = w.student_id
            where w.version_id = v.id and w.final_document_snapshot is not null and w.submitted_at is not null loop
    for s in select sc.id, sc.question_id, sc.maximum_marks, sc.awarded_marks from public.word_efficiency_question_scores sc
              where sc.attempt_id = a.id and sc.graded_by is null and sc.question_number = 14 loop
      select * into scored from public.word_efficiency_score_question(a.doc, v.id, s.question_id, s.maximum_marks, v.model_answer_snapshot);
      continue when scored.awarded is null or scored.awarded is not distinct from s.awarded_marks;
      update public.word_efficiency_question_scores set awarded_marks = scored.awarded, part_scores = scored.parts, grading_status = 'graded',
        teacher_comment = case when scored.awarded >= s.maximum_marks then 'Full marks: the required change was found in your document.' else 'No marks: the question was not done as asked.' end,
        updated_at = now()
       where id = s.id;
      select coalesce(sum(awarded_marks), 0), sum(maximum_marks) into total, maximum from public.word_efficiency_question_scores where attempt_id = a.id;
      if a.result ? 'marks' then
        update public.word_efficiency_attempts set result = coalesce(result, '{}'::jsonb) || jsonb_build_object('marks', total, 'maximum_marks', maximum,
            'percentage', case when maximum > 0 then round(total * 100 / maximum, 2) else 0 end,
            'passed', case when v.passing_marks is null then null else total >= v.passing_marks end), updated_at = now()
         where id = a.id;
      end if;
      insert into t4_remarked values (a.name, nullif(a.result->>'marks', '')::numeric, total);
    end loop;
  end loop;
end $$;

select student, old_marks, new_marks from t4_remarked order by student;

commit;
