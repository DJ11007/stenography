-- Hindi Word EFFICIENCY TEST 5 and TEST 6: marking checks rebuilt for every question, paper solutions written,
-- attempts marked again and results published automatically from now on.
--   TEST 5: Q5, Q7, Q8, Q9, Q10 had no check at all; Q1, Q3, Q6 were built automatically and checked the wrong thing
--           (nobody could get them). The (क) (ख) (ग) parts of a question are marked as one question.
--   TEST 6: Q6 to Q10 had no check; Q1 checked "not bold, not italic, size 8" - the opposite of the question.
-- Every check is hand-written (kept when the admin re-saves a question on the Model Answer page). Safe to run twice.
begin;

create temporary table wq (title text, qn integer, criteria jsonb, solution text) on commit drop;
insert into wq values
 -- ---------------------------------------------------------------- TEST 5
 ('EFFICIENCY TEST 5', 1, '[{"rule":"anyOf","criteria":[{"rule":"table","place":0,"headerAt":{"0":"Øe la[;k"}},{"rule":"table","place":0,"headerAt":{"0":"क्रम संख्या"}}]},
   {"rule":"anyOf","criteria":[{"rule":"table","place":0,"headerAt":{"1":"fon~;kFkhZ dk uke"}},{"rule":"table","place":0,"headerAt":{"1":"fo|kFkhZ dk uke"}},{"rule":"table","place":0,"headerAt":{"1":"विद्यार्थी का नाम"}}]},
   {"rule":"anyOf","criteria":[{"rule":"table","place":0,"headerAt":{"2":"firk dk uke"}},{"rule":"table","place":0,"headerAt":{"2":"पिता का नाम"}}]},
   {"rule":"anyOf","criteria":[{"rule":"table","place":0,"headerAt":{"3":"tUe frfFk"}},{"rule":"table","place":0,"headerAt":{"3":"जन्म तिथि"}}]},
   {"rule":"anyOf","criteria":[{"rule":"table","place":0,"headerAt":{"4":"eksckby uacj"}},{"rule":"table","place":0,"headerAt":{"4":"मोबाइल नंबर"}}]}]',
  E'टेबल की पहली रो के पाँच सेल में क्रम से टाइप करें (हिंदी फॉन्ट Kruti Dev 010 या Unicode हिंदी):\n(क) **क्रम संख्या** (ख) **विद्यार्थी का नाम** (ग) **पिता का नाम** (घ) **जन्म तिथि** (ङ) **मोबाइल नंबर**\n(Kruti Dev में: Øe la[;k, fon~;kFkhZ dk uke, firk dk uke, tUe frfFk, eksckby uacj)\n\nजाँच: पहली रो में पाँचों हेडिंग।'),
 ('EFFICIENCY TEST 5', 2, '[{"rule":"table","place":0,"onlyRow":1,"cellProps":{"fontSize":[14],"color":["FF0000"],"bold":[true],"italic":[true]}}]',
  E'1. टेबल की डेटा वाली रो (1. ajay … 7062331234) सेलेक्ट करें।\n2. HOME → Font Size **14**, Font Color **Red**, **Bold** (Ctrl+B) और **Italic** (Ctrl+I)।\n\nजाँच: डेटा की रो साइज 14, लाल, बोल्ड और इटैलिक।'),
 ('EFFICIENCY TEST 5', 3, '[{"rule":"value","kind":"body","place":0,"target":"blocks.0.alignment","spec":["right"]},
   {"rule":"value","kind":"body","place":1,"target":"blocks.0.alignment","spec":["center"]},
   {"rule":"value","kind":"body","place":2,"target":"blocks.0.alignment","spec":["justify"]}]',
  E'(क) पहले पैराग्राफ में क्लिक → HOME → **Align Right** (Ctrl+R)।\n(ख) दूसरे पैराग्राफ में क्लिक → HOME → **Center** (Ctrl+E)।\n(ग) तीसरे पैराग्राफ में क्लिक → HOME → **Justify** (Ctrl+J)।\n\nजाँच: पहला दाएँ, दूसरा बीच में, तीसरा जस्टिफाई।'),
 ('EFFICIENCY TEST 5', 4, '[{"rule":"value","kind":"body","place":0,"target":"blocks.0.attrs.lineHeight","spec":["1.25"]},
   {"rule":"words","kind":"body","place":0,"props":{"charSpacing":[2.3]}}]',
  E'पहला पैराग्राफ सेलेक्ट करें:\n(क) HOME → Paragraph ग्रुप **↘** → Line spacing **Multiple**, At **1.25** → **OK**।\n(ख) HOME → Font ग्रुप **↘** (Ctrl+D) → **Advanced** → Spacing **Expanded**, By **2.3 pt** → **OK**।\n\nजाँच: लाइन स्पेसिंग 1.25 और अक्षरों में 2.3 pt का फैलाव।'),
 ('EFFICIENCY TEST 5', 5, '[{"rule":"value","kind":"body","place":1,"target":"blocks.0.attrs.border","spec":{"regex":"(bottom,left|left,bottom)\\s*$"}}]',
  E'1. दूसरे पैराग्राफ में क्लिक करें।\n2. HOME → **Borders ▾** → **Left Border**, फिर दोबारा **Borders ▾** → **Bottom Border**।\n   (या Borders and Shading → Setting **Custom** → Preview में केवल बायाँ और नीचे का बॉर्डर → Apply to **Paragraph**।)\n\nजाँच: दूसरे पैराग्राफ पर केवल बाईं और नीचे की लाइन।'),
 ('EFFICIENCY TEST 5', 6, '[{"rule":"value","kind":"body","place":0,"target":"blocks.0.attrs.dropCap","spec":[true]},
   {"rule":"value","kind":"body","place":0,"target":"blocks.0.attrs.dropCapLines","spec":[4]}]',
  E'1. पहले पैराग्राफ में क्लिक करें।\n2. INSERT → **Drop Cap ▾** → **Drop Cap Options…** → Position **Dropped**, Lines to drop **4** → **OK**।\n\nजाँच: पहले पैराग्राफ का पहला अक्षर 4 लाइन तक बड़ा।'),
 ('EFFICIENCY TEST 5', 7, '[{"rule":"run","kind":"footer","props":{"field":{"regex":"^page-number\\|.*\\|center$"},"text":{"regex":"^\\s*2\\s*$"},"bold":[true]}}]',
  E'1. INSERT → **Page Number ▾** → **Format Page Numbers…** → **Start at: 2** → **OK**।\n2. INSERT → **Page Number ▾** → **Bottom of Page** → **Plain Number 2** (बीच में)।\n3. फूटर में नंबर सेलेक्ट करें → HOME → **Bold** → **Close Header and Footer**।\n\nजाँच: फूटर के बीच में बोल्ड पेज नंबर 2।'),
 ('EFFICIENCY TEST 5', 8, '[{"rule":"anyOf","criteria":[{"rule":"text","kind":"header","find":"vf/kuLFk cksMZ","caseSensitive":true,"props":{"fontSize":[15],"color":["FF0000"],"bold":[true],"underline":[true],"underlineStyle":["double"]}},
                                {"rule":"text","kind":"header","find":"अधिनस्थ बोर्ड","props":{"fontSize":[15],"color":["FF0000"],"bold":[true],"underline":[true],"underlineStyle":["double"]}}]},
   {"rule":"text","kind":"header","find":"2026","props":{"fontSize":[15],"color":["FF0000"],"bold":[true],"underline":[true],"underlineStyle":["double"]}}]',
  E'1. INSERT → **Header ▾** → **Edit Header**।\n2. टाइप करें **अधिनस्थ बोर्ड - 2026** (Kruti Dev 010 में "vf/kuLFk cksMZ & 2026")।\n3. पूरा टेक्स्ट सेलेक्ट करें → Font Size **15**, Font Color **Red**, **Bold**, Font डायलॉग (Ctrl+D) → Underline style **Double** → **OK**।\n4. **Close Header and Footer**।\n\nजाँच: हेडर में "अधिनस्थ बोर्ड - 2026" साइज 15, लाल, बोल्ड, डबल अंडरलाइन।'),
 ('EFFICIENCY TEST 5', 9, '[{"rule":"value","target":"pageLayout.backgroundColor","spec":["92D050"]},
   {"rule":"value","target":"pageLayout.border","spec":{"regex":"dashed.*(00B050|rgb\\(0, ?176, ?80\\)).*sides:(top,bottom|bottom,top)"}}]',
  E'1. DESIGN → **Page Color ▾** → **Light Green**।\n2. DESIGN → **Page Borders** → Setting **Shadow** → Style **dashed (- - -)** → Color **Green**।\n3. Preview में बाईं और दाईं लाइन पर क्लिक करके हटा दें (केवल ऊपर और नीचे रहे) → **OK**।\n\nजाँच: पेज हल्का हरा, ऊपर और नीचे हरी डैश्ड बॉर्डर।'),
 ('EFFICIENCY TEST 5', 10, '[{"rule":"value","kind":"body","place":2,"target":"blocks.0.attrs.marginLeft","spec":{"regex":"^(16\\.56pt|0\\.23in)$"}},
   {"rule":"value","kind":"body","place":2,"target":"blocks.0.attrs.marginRight","spec":{"regex":"^(25\\.92pt|0\\.36in)$"}}]',
  E'1. तीसरे पैराग्राफ में क्लिक करें।\n2. HOME → Paragraph ग्रुप **↘** → Indentation **Left: 0.23"**, **Right: 0.36"** → **OK**।\n\nजाँच: तीसरे पैराग्राफ का बायाँ इंडेंट 0.23" और दायाँ 0.36"।'),
 -- ---------------------------------------------------------------- TEST 6
 ('EFFICIENCY TEST 6', 1, '[{"rule":"words","kind":"body","place":0,"props":{"fontSize":[10],"bold":[true],"italic":[true],"color":["F4B183"]}}]',
  E'पहला पैराग्राफ सेलेक्ट करें:\n1. HOME → **Shrink Font (A↓)** दो बार (12 → 10) या Font Size **10**।\n2. **Bold** (Ctrl+B) और **Italic** (Ctrl+I)।\n3. **Font Color ▾** → Theme Colors में **Orange, Accent 2, Lighter 40%**।\n\nजाँच: साइज 10, बोल्ड, इटैलिक, हल्का नारंगी।'),
 ('EFFICIENCY TEST 6', 2, '[{"rule":"value","kind":"body","place":3,"target":"blocks.0.attrs.backgroundColor","spec":{"regex":"92D050|rgb\\(146, ?208, ?80\\)"}},
   {"rule":"text","kind":"body","place":3,"find":"VIDEO PROVIDES A POWERFUL WAY TO HELP YOU PROVE YOUR POINT","caseSensitive":true}]',
  E'चौथा पैराग्राफ ("Video provides…") सेलेक्ट करें:\n1. HOME → **Change Case (Aa ▾)** → **UPPERCASE**।\n2. HOME → **Shading ▾** → **Light Green** (या Borders and Shading → Shading → Fill **Light Green** → Apply to **Paragraph**)।\n\nजाँच: चौथा पैराग्राफ अपर केस और हल्की हरी शेडिंग।'),
 ('EFFICIENCY TEST 6', 3, '[{"rule":"words","kind":"body","place":1,"props":{"italic":[false,null],"underline":[false,null],"highlight":[null]}}]',
  E'दूसरा पैराग्राफ सेलेक्ट करें:\n1. HOME → **Italic** (Ctrl+I) बंद करें।\n2. **Underline** (Ctrl+U) बंद करें।\n3. **Text Highlight Color ▾** → **No Color**।\n\nजाँच: दूसरे पैराग्राफ में न इटैलिक, न अंडरलाइन, न हाइलाइट।'),
 ('EFFICIENCY TEST 6', 4, '[{"rule":"words","kind":"body","place":1,"props":{"outline":[true],"color":["F4B183"]}}]',
  E'दूसरा पैराग्राफ सेलेक्ट करें → HOME → **Text Effects and Typography (A ▾)** → **Outline** → **Orange, Accent 2, Lighter 40%**।\n\nजाँच: दूसरे पैराग्राफ के अक्षर हल्की नारंगी आउटलाइन में।'),
 ('EFFICIENCY TEST 6', 5, '[{"rule":"words","kind":"body","place":2,"props":{"strike":[false,null],"doubleStrike":[true]}}]',
  E'तीसरा पैराग्राफ सेलेक्ट करें → Font डायलॉग (Ctrl+D) → Effects में **Strikethrough** ✘ और **Double strikethrough** ✔ → **OK**।\n\nजाँच: तीसरे पैराग्राफ में सिंगल नहीं, डबल स्ट्राइकथ्रू।'),
 ('EFFICIENCY TEST 6', 6, '[{"rule":"anyOf","criteria":[{"rule":"words","kind":"body","place":4,"props":{"fontFamily":["Kokila"],"bold":[true],"italic":[true],"fontSize":[18],"color":[null,"000000","020618"]}},
                                {"rule":"words","kind":"body","place":4,"props":{"fontFamily":["Kokila"],"bold":[true],"italic":[true],"fontSize":[18],"color":{"regex":"^(?!FF0000$)"}}}]}]',
  E'पाँचवाँ पैराग्राफ ("To make your document…") सेलेक्ट करें:\n1. HOME → **Clear All Formatting** (A ✘) — लाल रंग, साइज 16 आदि हट जाएँ।\n2. Font **Kokila**, Font Size **18**, **Bold** और **Italic**।\n\nजाँच: पाँचवाँ पैराग्राफ Kokila, 18, बोल्ड, इटैलिक, लाल नहीं।'),
 ('EFFICIENCY TEST 6', 7, '[{"rule":"words","kind":"body","place":4,"props":{"charScale":[80],"charSpacing":[2.5]}}]',
  E'पाँचवाँ पैराग्राफ सेलेक्ट करें → Font डायलॉग (Ctrl+D) → **Advanced** → Scale **80%**, Spacing **Expanded** By **2.5 pt** → **OK**।\n\nजाँच: स्केल 80% और 2.5 pt का फैलाव।'),
 ('EFFICIENCY TEST 6', 8, '[{"rule":"words","kind":"body","place":5,"props":{"kerningEnabled":[true],"kerningMin":[3],"charPosition":[-5]}}]',
  E'छठा पैराग्राफ ("Themes and styles…") सेलेक्ट करें → Font डायलॉग (Ctrl+D) → **Advanced** → **Kerning for fonts** ✔ **3** Points and above, Position **Lowered** By **5 pt** → **OK**।\n\nजाँच: कर्निंग 3 pt और 5 pt नीचे।'),
 ('EFFICIENCY TEST 6', 9, '[{"rule":"text","kind":"body","place":6,"find":"12","props":{"subscript":[true]}},
   {"rule":"words","kind":"body","place":6,"props":{"bold":[true],"fontSize":[15]}}]',
  E'1. "C12" में **12** सेलेक्ट करें → HOME → **Subscript (x₂)** (Ctrl+=)।\n2. पूरा **C12** सेलेक्ट करें → **Bold**, Font Size **15**।\n\nजाँच: C₁₂ बोल्ड और साइज 15।'),
 ('EFFICIENCY TEST 6', 10, '[{"rule":"words","kind":"body","place":7,"props":{"highlight":["00FFFF"],"fontSize":[16],"bold":[true]}},
   {"rule":"value","kind":"body","place":7,"target":"blocks.0.alignment","spec":["center"]}]',
  E'अंतिम पैराग्राफ ("This is you font group…") सेलेक्ट करें:\n1. HOME → **Text Highlight Color ▾** → **Turquoise**।\n2. Font Size **16**, **Bold**, **Center** (Ctrl+E)।\n\nजाँच: अंतिम पैराग्राफ फ़िरोज़ी हाइलाइट, 16, बोल्ड, बीच में।');

do $$
declare test_title text; v record; q record; a record; s record; scored record; total numeric; maximum numeric;
begin
  foreach test_title in array array['EFFICIENCY TEST 5', 'EFFICIENCY TEST 6'] loop
    select t.id test_id, ver.id, ver.passing_marks, ver.model_answer_snapshot into v
      from public.word_efficiency_tests t join public.word_efficiency_versions ver on ver.id = t.current_version_id
     where t.language = 'Hindi' and t.title = test_title;
    for q in select x.id, x.marks, wq.criteria, wq.solution from public.word_efficiency_questions x join wq on wq.qn = x.question_number and wq.title = test_title where x.version_id = v.id loop
      delete from public.word_efficiency_grading_rules where version_id = v.id and question_id = q.id;
      insert into public.word_efficiency_grading_rules (version_id, question_id, exact_target, expected_operation, expected_value, allocated_marks, partial_marks, additional_criteria, part_label)
      values (v.id, q.id, 'rule', 'model-answer-match-v2', 'null'::jsonb, q.marks, null, q.criteria, null);
      update public.word_efficiency_questions set solution = q.solution where id = q.id;
    end loop;

    for a in select w.id, w.final_document_snapshot doc, w.evaluation_status from public.word_efficiency_attempts w
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
  end loop;
end $$;

select t.title, coalesce(p.full_name, w.student_id::text) student, w.evaluation_status, w.result->>'marks' marks
  from public.word_efficiency_attempts w join public.word_efficiency_tests t on t.current_version_id = w.version_id
  left join public.profiles p on p.id = w.student_id
 where t.language = 'Hindi' and t.title in ('EFFICIENCY TEST 5', 'EFFICIENCY TEST 6') and w.submitted_at is not null
 order by t.title, w.submitted_at;

commit;
