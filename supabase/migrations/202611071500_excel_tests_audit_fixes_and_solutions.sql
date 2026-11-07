-- Excel Efficiency audit (7 Nov): every question of the three current English Excel tests checked against its wording.
--
-- EXCEL TEST 1 (8004a8fe): the checks give the correct answer 25/25 (tests/fixtures/excel-test1-model.json); the
--   stored model answer is incomplete, the checks are not wrong. Q2 "A28:L31 (a) Merge across (b) font red (c) Font
--   size 14" had 5 parts, so it could not be marked by section; now (a) A28:L28..A31:L31 merged across, (b) red,
--   (c) 14 pt.
-- EXCEL TEST 2 (9f5fc11d, version 13, saved 3 Nov): its checks were built from the model answer again and asked for
--   things the questions never ask:
--   Q5  2 decimal places on A26:A37 (the model pressed Increase Decimal) -- removed; Blue, Accent 1 is 5B9BD5 in
--       Excel 2013 (4472C4 in newer Excel), both count.
--   Q6  bold, dark red and underline on A40:I43 -- removed; only Left (Indent) with indent 10 on A40:I44 is asked.
--   Q9  0 decimal places on the percentages -- removed; Percent Style is what is asked (I4 = G4/500 shows 50%).
--   Q1  (a) A19 (b) A21 (c) A23 and Q4 (a) 16 pt (b) Double Underline (c) Orange, Accent 2, Lighter 40% each had one
--       check, so they could not be marked by section; now one part per section.
--   Its paper solution was written for older wording (Thick Box Border, Dark Red fill, Paste Formats...): Q1, Q2, Q4,
--   Q5 and Q6 rewritten.
-- EXCEL TEST 3 (8f59bf4c): checks unchanged (rewritten 202611071100); it had no paper solution -- written (text only).
--
-- All checks of the three versions are marked exact_target 'hand-written', so the Model Answer page keeps them when a
-- question is solved again. The changed questions' finished attempts are marked again.
begin;

-- EXCEL TEST 1 Q2
delete from public.excel_efficiency_grading_rules
 where version_id = '8004a8fe-5254-489b-b328-07d005b78029'
   and question_id in (select id from public.excel_efficiency_questions where version_id = '8004a8fe-5254-489b-b328-07d005b78029' and question_number = 2);

-- EXCEL TEST 2 Q1, Q4, Q5, Q6, Q9 (Q9: only its Percent Style check; its 24 total/percentage value checks stay)
delete from public.excel_efficiency_grading_rules
 where version_id = '9f5fc11d-a5db-475f-b4e9-910be94b299e'
   and question_id in (select id from public.excel_efficiency_questions where version_id = '9f5fc11d-a5db-475f-b4e9-910be94b299e' and question_number in (1, 4, 5, 6));
delete from public.excel_efficiency_grading_rules
 where version_id = '9f5fc11d-a5db-475f-b4e9-910be94b299e' and part_label = 'a'
   and question_id in (select id from public.excel_efficiency_questions where version_id = '9f5fc11d-a5db-475f-b4e9-910be94b299e' and question_number = 9);

insert into public.excel_efficiency_grading_rules (version_id, question_id, exact_target, expected_operation, expected_value, allocated_marks, partial_marks, additional_criteria, part_label)
select r.version_id::uuid, q.id, 'hand-written', 'rule-criteria', 'null'::jsonb, r.marks, null, r.criteria::jsonb, r.part_label
from (values
 ('8004a8fe-5254-489b-b328-07d005b78029', 2, 'a', 0.83, '[{"rule":"merged","ranges":["A28:L28","A29:L29","A30:L30","A31:L31"]}]'),
 ('8004a8fe-5254-489b-b328-07d005b78029', 2, 'b', 0.83, '[{"rule":"cells","range":"A28:A31","props":{"fontColor":["FF0000"]}}]'),
 ('8004a8fe-5254-489b-b328-07d005b78029', 2, 'c', 0.84, '[{"rule":"cells","range":"A28:A31","props":{"fontSize":[14]}}]'),
 ('9f5fc11d-a5db-475f-b4e9-910be94b299e', 1, 'a', 0.92, '[{"rule":"cells","range":"A19","props":{"fillColor":["F4B183"]}}]'),
 ('9f5fc11d-a5db-475f-b4e9-910be94b299e', 1, 'b', 0.92, '[{"rule":"cells","range":"A21","props":{"fillColor":["F4B183"]}}]'),
 ('9f5fc11d-a5db-475f-b4e9-910be94b299e', 1, 'c', 0.93, '[{"rule":"cells","range":"A23","props":{"fillColor":["F4B183"]}}]'),
 ('9f5fc11d-a5db-475f-b4e9-910be94b299e', 4, 'a', 0.92, '[{"rule":"cells","range":"A25:J25","props":{"fontSize":[16]}}]'),
 ('9f5fc11d-a5db-475f-b4e9-910be94b299e', 4, 'b', 0.92, '[{"rule":"cells","range":"A25:J25","props":{"underline":[true],"underlineStyle":["double"]}}]'),
 ('9f5fc11d-a5db-475f-b4e9-910be94b299e', 4, 'c', 0.93, '[{"rule":"cells","range":"A25:J25","props":{"fillColor":["F4B183"]}}]'),
 ('9f5fc11d-a5db-475f-b4e9-910be94b299e', 5, null, 2.77, '[{"rule":"cells","range":"A26:A37","props":{"fontFamily":["Tahoma"],"bold":[true],"italic":[true],"fontSize":[15],"underline":[true],"underlineStyle":["doubleAccounting"],"fontColor":["5B9BD5","4472C4"],"strike":[true]}}]'),
 ('9f5fc11d-a5db-475f-b4e9-910be94b299e', 6, null, 2.77, '[{"rule":"cells","range":"A40:A44","props":{"align":["left"],"indent":[10]}}]'),
 ('9f5fc11d-a5db-475f-b4e9-910be94b299e', 9, 'a', 0.11, '[{"rule":"cells","range":"I4:I15","props":{"numberFormat":["Percentage"]}}]')
) as r(version_id, question_number, part_label, marks, criteria)
join public.excel_efficiency_questions q on q.version_id = r.version_id::uuid and q.question_number = r.question_number;

update public.excel_efficiency_grading_rules set exact_target = 'hand-written'
 where version_id in ('8004a8fe-5254-489b-b328-07d005b78029', '9f5fc11d-a5db-475f-b4e9-910be94b299e', '8f59bf4c-117a-4b87-ac19-19dc6b2125bc')
   and exact_target is distinct from 'hand-written';

-- Paper solutions (text only)
update public.excel_efficiency_questions q set solution = s.solution
from (values
 ('9f5fc11d-a5db-475f-b4e9-910be94b299e', 1, E'1. Click **A19** (it is merged with A19:J20).\n2. Hold **Ctrl** and click **A21** and **A23**.\n3. HOME → **Fill Color ▾** (Font group) → Theme Colors: **Orange, Accent 2, Lighter 40%** (6th column, 3rd row).\n\nChecked by section: (a) A19 (b) A21 (c) A23 — each section done gives its marks.'),
 ('9f5fc11d-a5db-475f-b4e9-910be94b299e', 2, E'1. Select **A25:J37**.\n2. HOME → **Borders ▾** (Font group) → **All Borders**.\n\nChecked: every cell of A25:J37 has a border on all four sides.'),
 ('9f5fc11d-a5db-475f-b4e9-910be94b299e', 4, E'1. Select **A25:J25**.\n2. (a) HOME → **Font Size** box → **16**.\n3. (b) HOME → **Underline ▾** → **Double Underline**.\n4. (c) HOME → **Fill Color ▾** → Theme Colors: **Orange, Accent 2, Lighter 40%**.\n\nChecked by section: (a) 16 pt (b) double underline (c) the orange fill — each section done gives its marks.'),
 ('9f5fc11d-a5db-475f-b4e9-910be94b299e', 5, E'1. Select **A26:A37**.\n2. HOME → **Font** box → **Tahoma**; **Font Size** → **15**; click **Bold** and **Italic**.\n3. HOME → **Font Color ▾** → Theme Colors: **Blue, Accent 1** (5th column, top row).\n4. HOME → Font group → the small arrow at its bottom-right corner (**Format Cells: Font**) → Underline: **Double Accounting** → tick **Strikethrough** → OK.\n\nChecked: all of these on A26:A37 (the question is marked as a whole).'),
 ('9f5fc11d-a5db-475f-b4e9-910be94b299e', 6, E'1. Select **A40:I44**.\n2. HOME → Alignment group → the small arrow at its bottom-right corner (**Format Cells: Alignment**).\n3. Horizontal: **Left (Indent)** → Indent: **10** → OK.\n\nChecked: A40:A44 (each row is merged across to I) left aligned with indent 10. Do not change anything else.'),
 ('8f59bf4c-117a-4b87-ac19-19dc6b2125bc', 1, E'1. Click **A55**.\n2. Type **Total of district** and press Enter.\n\nChecked: A55 = "Total of district" (capital or small letters both count).'),
 ('8f59bf4c-117a-4b87-ac19-19dc6b2125bc', 2, E'1. Click **A56**.\n2. Type **Minimum in district** and press Enter.\n\nChecked: A56 = "Minimum in district".'),
 ('8f59bf4c-117a-4b87-ac19-19dc6b2125bc', 3, E'1. Click **A57**.\n2. Type **Maximum in district** and press Enter.\n\nChecked: A57 = "Maximum in district".'),
 ('8f59bf4c-117a-4b87-ac19-19dc6b2125bc', 4, E'1. Click **A58**.\n2. Type **Average of district** and press Enter.\n\nChecked: A58 = "Average of district".'),
 ('8f59bf4c-117a-4b87-ac19-19dc6b2125bc', 5, E'1. Click **A59**.\n2. Type **sales count** and press Enter.\n3. To give it the same formatting as the cells above: click **A58** → HOME → **Format Painter** → click **A59**.\n\nChecked: A59 = "sales count".'),
 ('8f59bf4c-117a-4b87-ac19-19dc6b2125bc', 6, E'1. Select **A55:A59**.\n2. HOME → **Font Color ▾** → Theme Colors: **Blue, Accent 5, Lighter 40%** (9th column, 3rd row).\n\nChecked: the font colour of A55:A59.'),
 ('8f59bf4c-117a-4b87-ac19-19dc6b2125bc', 7, E'Rows 2 to 54 hold the data. In column D (Jaipur):\n1. **D55**: =SUM(D2:D54)\n2. **D56**: =MIN(D2:D54)\n3. **D57**: =MAX(D2:D54)\n4. **D58**: =AVERAGE(D2:D54)\n5. **D59**: =COUNT(D2:D54)\n(HOME → **AutoSum ▾** gives Sum, Average, Count Numbers, Max and Min — check that the range it picks is D2:D54.)\n6. Select **D55:D59** and drag the fill handle (small square at the bottom-right corner) right to column **I**.\n\nChecked: D55:I59 (Ajmer, Jodhpur, Bikaner, Ganganagar and basic pay too), e.g. Jaipur total 276241, count 53.'),
 ('8f59bf4c-117a-4b87-ac19-19dc6b2125bc', 8, E'1. Click **B2** (the cell below the top row and right of the first column).\n2. VIEW → **Freeze Panes ▾** → **Freeze Panes**.\n\nDo not use Freeze Top Row and then Freeze First Column: the second one replaces the first. Checked: panes frozen at B2.'),
 ('8f59bf4c-117a-4b87-ac19-19dc6b2125bc', 9, E'1. Select **A1:L60**.\n2. HOME → **Align Left** (or Format Cells: Alignment → Horizontal: **Left (Indent)**). Excel''s indent takes whole numbers only, so the indent is not checked.\n3. Keep A1:L60 selected → PAGE LAYOUT → **Print Area ▾** → **Set Print Area**.\n\nChecked: A1:L60 left aligned and the print area A1:L60.'),
 ('8f59bf4c-117a-4b87-ac19-19dc6b2125bc', 10, E'1. Click **A62** (merged A62:K65).\n2. HOME → **Fill Color ▾** → **Yellow** (Standard Colors).\n3. HOME → **Middle Align**.\n4. Select rows **62 to 65** by dragging over the row numbers → right-click → **Hide** (or HOME → Format ▾ → Hide & Unhide → Hide Rows).\n\nChecked: yellow fill and middle alignment, and rows 62–65 hidden. Shade first, then hide.'),
 ('8f59bf4c-117a-4b87-ac19-19dc6b2125bc', 11, E'Salary = basic pay ÷ 30 × days present.\n1. Click **K2**, type **=I2/30*B2** and press Enter (Rajnish: 30000 ÷ 30 × 21 = 21000).\n2. Click K2 again and double-click its fill handle (or drag it down to **K54**).\n\nChecked: the salary of every candidate in K2:K54.'),
 ('8f59bf4c-117a-4b87-ac19-19dc6b2125bc', 12, E'1. Right-click the sheet tab **STYLES** at the bottom → **Rename** (or double-click the tab).\n2. Type **LDC 2026** and press Enter.\n\nChecked: the sheet name is LDC 2026.'),
 ('8f59bf4c-117a-4b87-ac19-19dc6b2125bc', 13, E'1. Right-click the sheet tab **LDC 2026** → **Tab Color** → **Red** (Standard Colors).\n\nChecked: the tab colour is red (Dark Red also counts).'),
 ('8f59bf4c-117a-4b87-ac19-19dc6b2125bc', 14, E'1. INSERT → **Header & Footer**.\n2. Click the **left** section of the header → DESIGN → **File Name**.\n3. Click the **center** section → type **SAMRADHI CLASSES**.\n4. Click any cell of the sheet to close the header.\n\nChecked: left = file name, center = SAMRADHI CLASSES.'),
 ('8f59bf4c-117a-4b87-ac19-19dc6b2125bc', 15, E'1. INSERT → **Header & Footer** → DESIGN → **Go to Footer**.\n2. **Left** section: DESIGN → **Current Date**, type a space, DESIGN → **Current Time**.\n3. **Center** section: DESIGN → **Sheet Name**.\n4. **Right** section: DESIGN → **Page Number**.\n5. Click any cell of the sheet.\n\nChecked: left = date and time, center = sheet name, right = page number.')
) as s(version_id, question_number, solution)
where q.version_id = s.version_id::uuid and q.question_number = s.question_number;

-- Mark the changed questions again
create temporary table remarked (test text, student text, old_marks numeric, new_marks numeric) on commit drop;

do $$
declare v record; a record; q record; earned numeric; total numeric; maximum numeric; changed boolean;
begin
  for v in select ver.id, ver.passing_marks passing, t.title as test,
                  case ver.id when '8004a8fe-5254-489b-b328-07d005b78029' then array[2] else array[1, 4, 5, 6, 9] end as questions
             from public.excel_efficiency_versions ver join public.excel_efficiency_tests t on t.id = ver.test_id
            where ver.id in ('8004a8fe-5254-489b-b328-07d005b78029', '9f5fc11d-a5db-475f-b4e9-910be94b299e') loop
    for a in select w.id, w.final_document_snapshot doc, w.result, coalesce(p.full_name, w.student_id::text) name
               from public.excel_efficiency_attempts w left join public.profiles p on p.id = w.student_id
              where w.version_id = v.id and w.final_document_snapshot is not null loop
      changed := false;
      for q in select s.id, s.question_id, s.maximum_marks, s.awarded_marks from public.excel_efficiency_question_scores s
                 join public.excel_efficiency_questions x on x.id = s.question_id
                where s.attempt_id = a.id and s.graded_by is null and x.question_number = any(v.questions) loop
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
        insert into remarked values (v.test, a.name, nullif(a.result->>'marks', '')::numeric, total);
      end if;
    end loop;
  end loop;
end $$;

select test, student, old_marks, new_marks from remarked order by test, student;

commit;
