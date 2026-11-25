// Writes the migration that gives Hindi Word EFFICIENCY TEST 8, TEST 9 and TEST 10 their new papers (25 Nov 2026) as
// NEW versions: each paper's own practice document, 15 questions (tests/fixtures/hindi-word-tests-8-10-v2.json, built
// by build-hindi-word-tests-8-10-v2.mts), their hand-written checks and Hindi solutions, and the Model Answer solved in
// the real editor (tests/fixtures/hindi-word-test{8,9,10}-v2-model.json). Checked by
// tests/hindi-word-tests-8-10-v2-rules-runtime.test.mjs.
//   node scripts/build-hindi-word-tests-8-10-v2-migration.mjs
import { readFileSync, writeFileSync } from "node:fs";

const spec = JSON.parse(readFileSync("tests/fixtures/hindi-word-tests-8-10-v2.json", "utf8"));
const dollar = (text) => { let tag = "$q$"; for (let i = 0; text.includes(tag); i++) tag = `$q${i}$`; return `${tag}${text}${tag}`; };
const marksFor = (count) => Array.from({ length: count }, (_, index) => (index === count - 1 ? Math.round((25 - 1.66 * (count - 1)) * 100) / 100 : 1.66));
// The ribbon tools switched on in the new versions' editor settings (tab, group, option): every tool of the exam's tabs.
// The server refuses a document as soon as the effect of a switched-off tool is in it (assert_word_efficiency_capability_
// changes), and it compares more than the question asked for: formatting run by run (a question that splits a
// paragraph into runs changes every font feature of it), alignment and the like per block (a new header, footer or page
// break is a new block), the page's aspect ratio (any page size). So the papers need whole groups, not single tools.
const GROUPS = {
  Home: { clipboard: "undo,redo,paste,cut,copy,formatPainter", font: "fontName,fontSize,increaseFontSize,decreaseFontSize,changeCase,bold,italic,underline,strikeThrough,subscript,superscript,textEffects,highlightColor,fontColor,fontDialog",
    paragraph: "bullets,numbering,multilevelList,decreaseIndent,increaseIndent,sort,formattingMarks,alignLeft,alignCenter,alignRight,justify,lineSpacing,shading,borders,paragraphDialog", editing: "find,replace,selectAll" },
  Insert: { pages: "coverPage,blankPage,pageBreak", tables: "insertTable", headerFooter: "header,footer,pageNumber", text: "dropCap,dateTime", symbols: "symbol", links: "hyperlink,bookmark,crossReference", illustrations: "insertPicture,onlinePictures,shapes" },
  Design: { pageBackground: "watermark,pageColor,pageBorders" },
  "Page Layout": { pageSetup: "margins,orientation,pageSize,columns,sectionBreak,lineNumbers" },
};
const COMMON = Object.entries(GROUPS).flatMap(([tab, groups]) => Object.entries(groups).flatMap(([group, options]) => options.split(",").map((option) => [tab, group, option])));
const TOOLS = {
  "EFFICIENCY TEST 8": [["Home", "clipboard", "formatPainter"], ["Home", "font", "changeCase"], ["Home", "font", "underline"], ["Home", "font", "fontColor"], ["Home", "font", "bold"], ["Home", "paragraph", "bullets"], ["Home", "paragraph", "borders"], ["Insert", "pages", "blankPage"], ["Design", "pageBackground", "pageBorders"]],
  "EFFICIENCY TEST 9": [["Home", "font", "changeCase"], ["Home", "font", "underline"], ["Home", "paragraph", "decreaseIndent"], ["Home", "paragraph", "bullets"], ["Home", "paragraph", "sort"], ["Design", "pageBackground", "watermark"], ["Page Layout", "pageSetup", "columns"]],
  "EFFICIENCY TEST 10": [["Home", "font", "highlightColor"], ["Home", "paragraph", "numbering"], ["Design", "pageBackground", "pageColor"]],
};
const papers = spec.tests.map((test, index) => {
  const number = [8, 9, 10][index];
  const model = JSON.parse(readFileSync(`tests/fixtures/hindi-word-test${number}-v2-model.json`, "utf8"));
  if (test.title !== `EFFICIENCY TEST ${number}` || test.questions.length !== 15) throw new Error(`unexpected paper ${test.title}`);
  const marks = marksFor(test.questions.length);
  const questions = test.questions.map((question, i) => ({ number: i + 1, instruction: question.instruction, marks: marks[i], criteria: question.criteria, solution: question.solution }));
  return { title: test.title, matter: test.matter, questions, model, tools: [...COMMON, ...TOOLS[test.title]] };
});

let sql = `-- Hindi Word EFFICIENCY TEST 8, TEST 9 and TEST 10: new papers (25 Nov 2026). The old ones asked the same kinds of
-- questions as Tests 5-7 (font size/colour, Change Case UPPERCASE, numbering, subscript, sort, Replace All, Page Break,
-- Insert Table, a symbol, header + page number, watermark, page colour, orientation + margins). Every new question asks
-- for a Word 2013 tool or option that no other Word Efficiency paper uses, and no question repeats across the papers,
-- over the tabs of the exam: HOME, INSERT, DESIGN, PAGE LAYOUT and TABLE TOOLS (DESIGN and LAYOUT). VIEW is not asked:
-- the view, zoom, ruler and gridlines are not saved with the document, so they cannot be marked.
--   TEST 8:  Format Painter, Sentence case, Dotted underline, Theme font colour, Square bullets, Top Border, page number
--            (top right, i ii iii), Insert Above + Merge Cells, AutoFit Window, Grid Table 6 Colorful, Total Row,
--            page border on the first page only, Letter, Mirrored margins, Blank Page.
--   TEST 9:  lowercase, Position Raised, Dashed underline, Decrease Indent, Diamond bullets, Sort a list Z-A, Page X of
--            Y, Text Direction, Formula =SUM(ABOVE), Cell Margins, List Table 3, horizontal custom watermark, Three
--            columns, Office 2003 Default margins, B5 (JIS).
--   TEST 10: Character Scale 150%, remove a highlight, All caps, numbering i ii iii, line spacing 3.0, Footer Blank
--            (Three Columns), Insert Left, row Height, Distribute Columns, Plain Table 4, Banded Columns, red All
--            Borders, theme page colour, Statement, Spacing After from PAGE LAYOUT.
-- Each test gets a NEW version with its own practice document (students' earlier attempts stay on their own version
-- with their marks), hand-written checks, Hindi solutions and the Model Answer solved in the real editor; results are
-- published automatically. The tools the questions need are switched on in the new versions' editor settings.
-- Generated by scripts/build-hindi-word-tests-8-10-v2-migration.mjs. Safe to run twice (a test already on its new paper
-- is skipped).
begin;

create temporary table new_paper (title text, matter jsonb, questions jsonb, model jsonb, tools jsonb) on commit drop;
insert into new_paper values\n`;
sql += papers.map((paper) => ` (${dollar(paper.title)}, ${dollar(JSON.stringify(paper.matter))}::jsonb, ${dollar(JSON.stringify(paper.questions))}::jsonb, ${dollar(JSON.stringify(paper.model))}::jsonb, ${dollar(JSON.stringify(paper.tools))}::jsonb)`).join(",\n") + ";\n";
sql += `
do $$
declare p record; old record; new_id uuid; q jsonb; question_id uuid; caps jsonb; tool jsonb;
begin
  for p in select * from new_paper loop
    select v.* into old from public.word_efficiency_tests t join public.word_efficiency_versions v on v.id = t.current_version_id
     where t.language = 'Hindi' and t.title = p.title;
    if old.id is null then raise exception 'Hindi Word % not found', p.title; end if;
    continue when exists (select 1 from public.word_efficiency_questions where version_id = old.id and question_number = 1 and instruction = p.questions->0->>'instruction');
    caps := coalesce(old.editor_capabilities, '{}'::jsonb);
    for tool in select value from jsonb_array_elements(p.tools) loop
      caps := jsonb_set(caps, array['tabs'], coalesce(caps->'tabs', '{}'::jsonb));
      caps := jsonb_set(caps, array['tabs', tool->>0], coalesce(caps #> array['tabs', tool->>0], '{}'::jsonb) || '{"enabled": true}');
      caps := jsonb_set(caps, array['tabs', tool->>0, 'groups'], coalesce(caps #> array['tabs', tool->>0, 'groups'], '{}'::jsonb));
      caps := jsonb_set(caps, array['tabs', tool->>0, 'groups', tool->>1], coalesce(caps #> array['tabs', tool->>0, 'groups', tool->>1], '{}'::jsonb) || '{"enabled": true}');
      caps := jsonb_set(caps, array['tabs', tool->>0, 'groups', tool->>1, 'options'], coalesce(caps #> array['tabs', tool->>0, 'groups', tool->>1, 'options'], '{}'::jsonb));
      caps := jsonb_set(caps, array['tabs', tool->>0, 'groups', tool->>1, 'options', tool->>2], 'true');
    end loop;
    insert into public.word_efficiency_versions (test_id, version_number, title, language, description, instructions_markdown, delivery_onscreen, delivery_pdf, delivery_realfile,
        student_question_toggle, question_count, maximum_marks, duration_options, passing_marks, created_by, working_matter_snapshot, editor_capabilities, model_answer_snapshot)
    values (old.test_id, (select max(version_number) + 1 from public.word_efficiency_versions where test_id = old.test_id), old.title, old.language, old.description, old.instructions_markdown,
        true, false, false, old.student_question_toggle, jsonb_array_length(p.questions), 25, old.duration_options, old.passing_marks, old.created_by, p.matter, caps, p.model)
    returning id into new_id;
    for q in select value from jsonb_array_elements(p.questions) loop
      insert into public.word_efficiency_questions (version_id, question_number, instruction, marks, section, display_order, is_visible, solution)
      values (new_id, (q->>'number')::integer, q->>'instruction', (q->>'marks')::numeric, null, (q->>'number')::integer, true, q->>'solution')
      returning id into question_id;
      insert into public.word_efficiency_grading_rules (version_id, question_id, exact_target, expected_operation, expected_value, allocated_marks, partial_marks, additional_criteria, part_label)
      values (new_id, question_id, 'rule', 'model-answer-match-v2', 'null'::jsonb, (q->>'marks')::numeric, null, q->'criteria', null);
    end loop;
    update public.word_efficiency_tests set current_version_id = new_id, current_version_number = (select version_number from public.word_efficiency_versions where id = new_id),
        auto_publish_results = true, updated_at = now()
     where id = old.test_id;
  end loop;
end $$;

-- Check: for each test the Model Answer earns every question's marks (25), the untouched paper none (0), and every tool
-- the questions need is switched on (tools_off empty).
select t.title, t.current_version_number, v.question_count, sum(q.marks) total,
       sum((public.word_efficiency_score_question(v.model_answer_snapshot, v.id, q.id, q.marks, v.model_answer_snapshot)).awarded) model_answer_gets,
       sum((public.word_efficiency_score_question(public.word_efficiency_initial_editor_document(v.working_matter_snapshot), v.id, q.id, q.marks, v.model_answer_snapshot)).awarded) untouched_paper_gets,
       (select coalesce(string_agg(tool->>2, ', '), '') from new_paper p, jsonb_array_elements(p.tools) tool
         where p.title = t.title and coalesce(v.editor_capabilities #>> array['tabs', tool->>0, 'groups', tool->>1, 'options', tool->>2], 'false') <> 'true') tools_off
  from public.word_efficiency_tests t join public.word_efficiency_versions v on v.id = t.current_version_id join public.word_efficiency_questions q on q.version_id = v.id
 where t.language = 'Hindi' and t.title in ('EFFICIENCY TEST 8', 'EFFICIENCY TEST 9', 'EFFICIENCY TEST 10')
 group by t.title, t.current_version_number, v.question_count, v.editor_capabilities
 order by t.title;

commit;
`;
writeFileSync("supabase/migrations/202611251200_hindi_word_tests_8_10_new_papers.sql", sql);
console.log(sql.length);
