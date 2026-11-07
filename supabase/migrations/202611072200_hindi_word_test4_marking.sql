-- Hindi Word EFFICIENCY TEST 4: marking checks rebuilt for all 15 questions, paper solutions written, attempts marked
-- again and results published automatically from now on.
-- The old checks were built automatically from one difference each and mostly checked the wrong thing (Q3 "footer
-- text" checked a bold word, Q4 checked the same, Q13 and Q14 both checked only the page margins, Q15 had none).
-- Every check is hand-written (kept when the admin re-saves a question on the Model Answer page).
-- Paragraphs are counted as in the paper: 1st..6th text paragraphs, then the lines C4H10O2 and A2-B3.
-- Safe to run twice.
begin;

create temporary table wq (qn integer, criteria jsonb, solution text) on commit drop;
insert into wq values
 (1, '[{"rule":"value","kind":"body","place":0,"target":"blocks.0.attrs.border","spec":{"regex":"rgb\\(0, ?(176, ?80|128, ?0)\\)|00B050|008000"}},
       {"rule":"value","kind":"body","place":2,"target":"blocks.0.attrs.border","spec":{"regex":"rgb\\(0, ?(176, ?80|128, ?0)\\)|00B050|008000"}},
       {"rule":"value","kind":"body","place":4,"target":"blocks.0.attrs.border","spec":{"regex":"rgb\\(0, ?(176, ?80|128, ?0)\\)|00B050|008000"}}]',
  E'1. पहला पैराग्राफ सेलेक्ट करें, फिर Ctrl दबाकर तीसरा और पाँचवाँ पैराग्राफ भी सेलेक्ट करें (या एक-एक करके करें)।\n2. HOME → Paragraph → **Borders ▾** → **Borders and Shading…** → Setting **Box**, Color **Green** → Apply to **Paragraph** → **OK**।\n   (या पहले Borders and Shading में रंग Green चुनें, फिर Borders ▾ → **Outside Borders**।)\n\nजाँच: पहले, तीसरे और पाँचवें पैराग्राफ के चारों ओर हरा बॉर्डर।'),
 (2, '[{"rule":"value","kind":"body","place":0,"target":"blocks.0.type","spec":["list-item"]},{"rule":"value","kind":"body","place":1,"target":"blocks.0.type","spec":["list-item"]},
       {"rule":"value","kind":"body","place":2,"target":"blocks.0.type","spec":["list-item"]},{"rule":"value","kind":"body","place":3,"target":"blocks.0.type","spec":["list-item"]},
       {"rule":"value","kind":"body","place":4,"target":"blocks.0.type","spec":["list-item"]},{"rule":"value","kind":"body","place":5,"target":"blocks.0.type","spec":["list-item"]},
       {"rule":"value","kind":"body","place":0,"target":"blocks.0.attrs.listStyle","spec":{"regex":"^(decimal|decimal-paren|upper-roman|lower-roman|upper-alpha|lower-alpha|lower-alpha-paren)$"}}]',
  E'1. पूरा डॉक्यूमेंट सेलेक्ट करें (Ctrl+A)।\n2. HOME → Paragraph → **Numbering ▾** → **1. 2. 3.**।\n\nजाँच: सभी पैराग्राफ के आगे क्रम से नंबर।'),
 (3, '[{"rule":"anyOf","criteria":[{"rule":"text","kind":"footer","find":"समृद्धि क्लासेस"},{"rule":"text","kind":"footer","find":"le`f) dyklsl"}]}]',
  E'1. INSERT → **Footer ▾** → **Edit Footer** (या पेज के नीचे डबल-क्लिक)।\n2. फूटर की बाईं ओर (शुरुआत में) **समृद्धि क्लासेस** टाइप करें (हिंदी फॉन्ट Kruti Dev 010 में "le`f) Dyklsl")।\n3. **Close Header and Footer**।\n\nजाँच: फूटर में बाईं ओर "समृद्धि क्लासेस"।'),
 (4, '[{"rule":"text","kind":"body","find":"galleries","minCount":2,"props":{"fontFamily":["Arial Narrow"],"color":["FF0000"],"bold":[true],"strike":[true]}}]',
  E'1. HOME → **Replace** (Ctrl+H) → Find what **galleries**, Replace with **galleries**।\n2. **More >>** → कर्सर Replace with में रखें → **Format ▾ → Font…** → Font **Arial Narrow**, Font style **Bold**, Font color **Red**, Effects **Strikethrough** ✔ → **OK**।\n3. **Replace All**।\n   (या दोनों "galleries" शब्द एक-एक करके सेलेक्ट करके Font डायलॉग (Ctrl+D) से यही सेटिंग दें।)\n\nजाँच: दोनों "galleries" शब्द Arial Narrow, लाल, बोल्ड और स्ट्राइकथ्रू।'),
 (5, '[{"rule":"value","kind":"body","place":0,"target":"blocks.0.alignment","spec":["right"]},
       {"rule":"value","kind":"body","place":0,"target":"blocks.0.attrs.lineHeight","spec":["1.36"]},
       {"rule":"text","kind":"body","place":0,"find":"VIDEO PROVIDES A POWERFUL WAY TO HELP YOU PROVE YOUR POINT","caseSensitive":true}]',
  E'पहला पैराग्राफ सेलेक्ट करें:\n1. HOME → **Align Right** (Ctrl+R)।\n2. HOME → Paragraph ग्रुप **↘** → Line spacing **Multiple**, At **1.36** → **OK**।\n3. HOME → **Change Case (Aa ▾)** → **UPPERCASE**।\n\nजाँच: पहला पैराग्राफ दाईं ओर, लाइन स्पेसिंग 1.36, सभी अक्षर बड़े (अपर केस)।'),
 (6, '[{"rule":"value","kind":"body","place":1,"target":"blocks.0.alignment","spec":["center"]},
       {"rule":"value","kind":"body","place":1,"target":"blocks.0.attrs.lineHeight","spec":["1.25"]},
       {"rule":"text","kind":"body","place":1,"find":"FOR EXAMPLE, YOU CAN ADD A MATCHING COVER PAGE","caseSensitive":true}]',
  E'दूसरा पैराग्राफ सेलेक्ट करें:\n1. HOME → **Center** (Ctrl+E)।\n2. HOME → Paragraph ग्रुप **↘** → Line spacing **Multiple**, At **1.25** → **OK**।\n3. HOME → **Change Case (Aa ▾)** → **UPPERCASE**।\n\nजाँच: दूसरा पैराग्राफ बीच में, लाइन स्पेसिंग 1.25, अपर केस।'),
 (7, '[{"rule":"value","kind":"body","place":2,"target":"blocks.0.alignment","spec":["justify"]},
       {"rule":"value","kind":"body","place":2,"target":"blocks.0.attrs.lineHeight","spec":{"regex":"^1(\\.0+)?$"}}]',
  E'तीसरे पैराग्राफ में क्लिक करें:\n1. HOME → **Justify** (Ctrl+J)।\n2. HOME → **Line and Paragraph Spacing ▾** → **1.0** (या Paragraph डायलॉग → Line spacing **Single**)।\n\nजाँच: तीसरा पैराग्राफ जस्टिफाई, लाइन स्पेसिंग 1.0।'),
 (8, '[{"rule":"text","kind":"body","place":6,"find":"4","props":{"subscript":[true]}},{"rule":"text","kind":"body","place":6,"find":"10","props":{"subscript":[true]}},
       {"rule":"text","kind":"body","place":6,"find":"2","props":{"subscript":[true]}}]',
  E'C4H10O2 में एक-एक संख्या (**4**, **10**, **2**) सेलेक्ट करें → HOME → **Subscript (x₂)** (Ctrl+=)।\n\nजाँच: C₄H₁₀O₂ — सभी संख्याएँ नीचे छोटी।'),
 (9, '[{"rule":"text","kind":"body","place":7,"find":"2","props":{"superscript":[true]}},{"rule":"text","kind":"body","place":7,"find":"3","props":{"superscript":[true]}}]',
  E'A2-B3 में बोल्ड अक्षर **2** और **3** एक-एक करके सेलेक्ट करें → HOME → **Superscript (x²)** (Ctrl+Shift+=)।\n\nजाँच: A²-B³।'),
 (10, '[{"rule":"text","kind":"body","place":3,"find":"you","wholeWord":true,"caseSensitive":true,"minCount":5,"props":{"highlight":["00FF00","008000"],"underline":[true],"underlineStyle":["double"],"underlineColor":["FF0000"]}}]',
  E'1. चौथे पैराग्राफ को सेलेक्ट करें → **Replace** (Ctrl+H) → Find what **you**, Replace with **you** → **More >>** → **Find whole words only** ✔ और **Match case** ✔।\n2. Replace with में कर्सर रखकर **Format ▾ → Highlight** (हाइलाइट का रंग पहले HOME → Text Highlight Color ▾ → **Green** चुना हो)।\n3. फिर **Format ▾ → Font…** → Underline style **Double**, Underline color **Red** → **OK** → **Replace All** → (No: बाकी डॉक्यूमेंट नहीं)।\n   (या हर "you" को डबल-क्लिक करके हाइलाइट Green और Font डायलॉग से डबल लाल अंडरलाइन दें।)\n\nजाँच: चौथे पैराग्राफ के सभी "you" शब्द हरे हाइलाइट और लाल डबल अंडरलाइन में।'),
 (11, '[{"rule":"words","kind":"body","place":4,"props":{"outline":[true],"color":["FFC000","ED7D31"],"bold":[true]}}]',
  E'पाँचवाँ पैराग्राफ सेलेक्ट करें:\n1. HOME → **Text Effects and Typography (A ▾)** → **Outline** → **Orange**।\n2. HOME → **Bold** (Ctrl+B)।\n\nजाँच: पाँचवाँ पैराग्राफ नारंगी आउटलाइन और बोल्ड।'),
 (12, '[{"rule":"anyOf","criteria":[{"rule":"run","kind":"footer","props":{"field":{"regex":"^date-time"}}},{"rule":"text","kind":"footer","find":"24 December 2026"}]}]',
  E'1. फूटर खोलें (INSERT → **Footer ▾** → **Edit Footer**)।\n2. HEADER & FOOTER TOOLS **DESIGN** → **Date & Time** → फॉर्मेट **24 December 2026 3:30 PM** जैसा (d MMMM yyyy h:mm am/pm) चुनें → **OK**।\n3. **Close Header and Footer**।\n\nजाँच: फूटर में दिनांक व समय।'),
 (13, '[{"rule":"value","target":"pageLayout.padding","spec":{"regex":"^(25\\.4mm 19\\.1mm 25\\.4mm 19\\.1mm|19\\.1mm 25\\.4mm 19\\.1mm 25\\.4mm)$"}},
       {"rule":"value","target":"pageLayout.aspectRatio","spec":{"regex":"^26\\.67 ?/ ?18\\.41$"}},
       {"rule":"value","target":"pageLayout.backgroundColor","spec":["92D050"]}]',
  E'1. PAGE LAYOUT → **Margins ▾** → **Moderate**।\n2. PAGE LAYOUT → **Size ▾** → **Executive**।\n3. PAGE LAYOUT → **Orientation ▾** → **Landscape**।\n4. DESIGN → **Page Color ▾** → **Light Green**।\n\nजाँच: मार्जिन Moderate, साइज Executive, लैंडस्केप, पेज का रंग हल्का हरा।'),
 (14, '[{"rule":"run","kind":"footer","props":{"field":{"regex":"^page-number\\|.*\\|right$"},"text":{"regex":"^\\s*4\\s*$"}}}]',
  E'1. INSERT → **Page Number ▾** → **Format Page Numbers…** → Page numbering **Start at: 4** → **OK**।\n2. INSERT → **Page Number ▾** → **Bottom of Page** → **Plain Number 3** (दाईं ओर)।\n\nजाँच: फूटर में दाईं ओर पेज नंबर 4।'),
 (15, '[{"rule":"value","kind":"body","place":3,"target":"blocks.0.attrs.dropCap","spec":[true]},
       {"rule":"value","kind":"body","place":3,"target":"blocks.0.attrs.dropCapLines","spec":[2]},
       {"rule":"value","kind":"body","place":3,"target":"blocks.0.attrs.dropCapMargin","spec":[false, null]}]',
  E'1. चौथे पैराग्राफ में क्लिक करें।\n2. INSERT → **Drop Cap ▾** → **Drop Cap Options…** → Position **Dropped**, Lines to drop **2** → **OK**।\n\nजाँच: चौथे पैराग्राफ का पहला अक्षर 2 लाइन तक बड़ा (ड्रॉप्ड)।');

-- Apply: one hand-written check per question (replacing whatever was there), the solutions, then mark again.
do $$
declare v record; q record; a record; s record; scored record; total numeric; maximum numeric;
begin
  select t.id test_id, ver.id, ver.passing_marks, ver.model_answer_snapshot into v
    from public.word_efficiency_tests t join public.word_efficiency_versions ver on ver.id = t.current_version_id
   where t.language = 'Hindi' and t.title = 'EFFICIENCY TEST 4';
  for q in select x.id, x.marks, wq.criteria, wq.solution from public.word_efficiency_questions x join wq on wq.qn = x.question_number where x.version_id = v.id loop
    delete from public.word_efficiency_grading_rules where version_id = v.id and question_id = q.id;
    insert into public.word_efficiency_grading_rules (version_id, question_id, exact_target, expected_operation, expected_value, allocated_marks, partial_marks, additional_criteria, part_label)
    values (v.id, q.id, 'rule', 'model-answer-match-v2', 'null'::jsonb, q.marks, null, q.criteria, null);
    update public.word_efficiency_questions set solution = q.solution where id = q.id;
  end loop;

  for a in select w.id, w.final_document_snapshot doc, w.result, w.evaluation_status from public.word_efficiency_attempts w
            where w.version_id = v.id and w.final_document_snapshot is not null and w.submitted_at is not null loop
    for s in select sc.id, sc.question_id, sc.maximum_marks from public.word_efficiency_question_scores sc where sc.attempt_id = a.id and sc.graded_by is null loop
      select * into scored from public.word_efficiency_score_question(a.doc, v.id, s.question_id, s.maximum_marks, v.model_answer_snapshot);
      continue when scored.awarded is null;
      update public.word_efficiency_question_scores set awarded_marks = scored.awarded, part_scores = scored.parts, grading_status = 'graded',
        teacher_comment = case when scored.awarded >= s.maximum_marks then 'Full marks: the required change was found in your document.'
                               else 'No marks: the question was not done as asked.' end, updated_at = now()
       where id = s.id;
    end loop;
    if a.evaluation_status = 'published' then
      select coalesce(sum(awarded_marks), 0), sum(maximum_marks) into total, maximum from public.word_efficiency_question_scores where attempt_id = a.id;
      update public.word_efficiency_attempts set result = coalesce(result, '{}'::jsonb) || jsonb_build_object('marks', total, 'maximum_marks', maximum,
          'percentage', case when maximum > 0 then round(total * 100 / maximum, 2) else 0 end,
          'passed', case when v.passing_marks is null then null else total >= v.passing_marks end), updated_at = now()
       where id = a.id;
      update public.live_exam_section_attempts l set marks = least(total, ls.max_marks)
        from public.live_exam_sections ls where ls.id = l.section_id and l.attempt_id = a.id;
    else
      perform public.word_efficiency_auto_publish_attempt(a.id);
    end if;
  end loop;

  update public.word_efficiency_tests set auto_publish_results = true where id = v.test_id;
end $$;

-- What students now have (one row per submitted attempt).
select coalesce(p.full_name, w.student_id::text) student, w.evaluation_status, w.result->>'marks' marks
  from public.word_efficiency_attempts w join public.word_efficiency_tests t on t.current_version_id = w.version_id
  left join public.profiles p on p.id = w.student_id
 where t.language = 'Hindi' and t.title = 'EFFICIENCY TEST 4' and w.submitted_at is not null
 order by w.submitted_at;

commit;
