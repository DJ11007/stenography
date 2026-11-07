-- Hindi Word EFFICIENCY TEST 3 (current version): five questions could never give marks and three paper solutions
-- belonged to an older paper (a table) and did not match the questions.
--   Q7  third paragraph: every "document" highlighted red (it checked one piece of the paragraph only)
--   Q8  fourth paragraph: Shrink Font twice, 12 -> 11 -> 10 (the check was empty)
--   Q11 fifth paragraph: text outline red (empty)
--   Q13 last paragraph: character spacing expanded 1.15 pt (empty)
--   Q14 third paragraph: kerning for fonts 1.25 pt and above (empty)
-- New checks are hand-written criteria (kept when the admin re-saves a question on the Model Answer page).
-- Submitted attempts of this version are marked again for these five questions only; marks a teacher gave by hand
-- are not touched. Safe to run twice.
begin;

create temporary table t3 (qn integer, criteria jsonb, solution text) on commit drop;
insert into t3 values
 (7,  '[{"rule":"text","kind":"body","place":2,"find":"document","props":{"highlight":["FF0000"]}}]',
      E'1. तीसरा पैराग्राफ ("Both the Themes gallery...") देखें।\n2. हर **document** शब्द को सेलेक्ट करें (डबल-क्लिक), फिर HOME → **Text Highlight Color ▾** → **Red**।\n   या: पहले Text Highlight Color ▾ में **Red** चुनें, तीसरा पैराग्राफ सेलेक्ट करें → **Replace** (Ctrl+H) → Find what **document** → **More >>** → **Format ▾ → Highlight** → **Replace All**।\n\nजाँच: तीसरे पैराग्राफ में हर "document" लाल रंग से हाइलाइट।'),
 (8,  '[{"rule":"words","kind":"body","place":3,"props":{"fontSize":[10]}}]',
      E'1. चौथा पैराग्राफ ("To change the looks available...") सेलेक्ट करें।\n2. HOME → **Shrink Font (A↓)** दो बार दबाएँ (या Ctrl+[ दो बार)।\n\nजाँच: फॉन्ट साइज 12 → 11 → **10**।'),
 (11, '[{"rule":"words","kind":"body","place":4,"props":{"outline":[true],"color":["FF0000"]}}]',
      E'1. पाँचवाँ पैराग्राफ ("To change the overall look...") सेलेक्ट करें।\n2. HOME → **Text Effects and Typography (A ▾)** → **Outline** → **Red**।\n\nजाँच: पाँचवें पैराग्राफ के अक्षर लाल आउटलाइन वाले।'),
 (13, '[{"rule":"words","kind":"body","place":4,"props":{"charSpacing":[1.15]}}]',
      E'1. अंतिम पैराग्राफ ("To change the overall look...") सेलेक्ट करें।\n2. HOME → Font ग्रुप **↘** (Ctrl+D) → **Advanced** टैब → Spacing **Expanded**, By **1.15 pt** → **OK**।\n\nजाँच: अंतिम पैराग्राफ के अक्षर 1.15 pt फैले हुए (एक्सपेंडेड)।'),
 (14, '[{"rule":"words","kind":"body","place":2,"props":{"kerningEnabled":[true],"kerningMin":[1.25]}}]',
      E'1. तीसरा पैराग्राफ ("Both the Themes gallery...") सेलेक्ट करें।\n2. HOME → Font ग्रुप **↘** (Ctrl+D) → **Advanced** टैब → **Kerning for fonts** ✔ → Points and above **1.25** → **OK**।\n\nजाँच: तीसरे पैराग्राफ पर Kerning for fonts 1.25 pt।');

update public.word_efficiency_grading_rules r
   set exact_target = 'rule', expected_operation = 'model-answer-match-v2', expected_value = 'null'::jsonb,
       additional_criteria = t3.criteria, allocated_marks = q.marks, partial_marks = null, part_label = null
  from public.word_efficiency_questions q join public.word_efficiency_tests t on t.current_version_id = q.version_id, t3
 where t.language = 'Hindi' and t.title = 'EFFICIENCY TEST 3' and r.question_id = q.id and q.question_number = t3.qn;

update public.word_efficiency_questions q set solution = t3.solution
  from public.word_efficiency_tests t, t3
 where t.language = 'Hindi' and t.title = 'EFFICIENCY TEST 3' and q.version_id = t.current_version_id and q.question_number in (8, 13, 14) and q.question_number = t3.qn;

-- Mark the submitted attempts of this version again, for these five questions.
create temporary table t3_remarked (student text, old_marks numeric, new_marks numeric) on commit drop;
do $$
declare v record; a record; s record; scored record; total numeric; maximum numeric; changed boolean;
begin
  select ver.id, ver.passing_marks, ver.model_answer_snapshot into v
    from public.word_efficiency_tests t join public.word_efficiency_versions ver on ver.id = t.current_version_id
   where t.language = 'Hindi' and t.title = 'EFFICIENCY TEST 3';
  for a in select w.id, w.final_document_snapshot doc, w.result, coalesce(p.full_name, w.student_id::text) name
             from public.word_efficiency_attempts w left join public.profiles p on p.id = w.student_id
            where w.version_id = v.id and w.final_document_snapshot is not null loop
    changed := false;
    for s in select sc.id, sc.question_id, sc.maximum_marks, sc.awarded_marks from public.word_efficiency_question_scores sc
              where sc.attempt_id = a.id and sc.graded_by is null and sc.question_number in (7, 8, 11, 13, 14) loop
      select * into scored from public.word_efficiency_score_question(a.doc, v.id, s.question_id, s.maximum_marks, v.model_answer_snapshot);
      continue when scored.awarded is null;
      if scored.awarded is distinct from s.awarded_marks then changed := true; end if;
      update public.word_efficiency_question_scores set awarded_marks = scored.awarded, part_scores = scored.parts, grading_status = 'graded',
        teacher_comment = case when scored.awarded >= s.maximum_marks then 'Full marks: the required change was found in your document.'
                               else 'No marks: the question was not done as asked.' end,
        updated_at = now()
       where id = s.id;
    end loop;
    if changed then
      select coalesce(sum(awarded_marks), 0), sum(maximum_marks) into total, maximum from public.word_efficiency_question_scores where attempt_id = a.id;
      if a.result ? 'marks' then
        update public.word_efficiency_attempts set result = coalesce(result, '{}'::jsonb) || jsonb_build_object('marks', total, 'maximum_marks', maximum,
            'percentage', case when maximum > 0 then round(total * 100 / maximum, 2) else 0 end,
            'passed', case when v.passing_marks is null then null else total >= v.passing_marks end), updated_at = now()
         where id = a.id;
        update public.live_exam_section_attempts l set marks = least(total, ls.max_marks)
          from public.live_exam_sections ls where ls.id = l.section_id and l.attempt_id = a.id;
      end if;
      insert into t3_remarked values (a.name, nullif(a.result->>'marks', '')::numeric, total);
    end if;
  end loop;
end $$;

select student, old_marks, new_marks from t3_remarked order by student;

commit;
