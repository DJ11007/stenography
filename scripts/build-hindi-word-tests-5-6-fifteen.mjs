// Writes the migration that brings Hindi Word EFFICIENCY TEST 5 and TEST 6 up to 15 questions (8 Nov 2026): each test
// gets a NEW version with the same practice document, its 10 questions and checks kept as they are (marks spread so the
// paper is out of 25 like every other test), 5 new questions over the groups the paper did not ask yet (HOME Editing,
// INSERT Pages / Table, DESIGN Page Background, PAGE LAYOUT Page Setup), their hand-written checks and Hindi
// solutions, and the Model Answer carried over with the 5 new answers added.
//   node scripts/build-hindi-word-tests-5-6-fifteen.mjs
import { writeFileSync } from "node:fs";

const anyOf = (...criteria) => ({ rule: "anyOf", criteria });
const value = (place, target, spec) => ({ rule: "value", kind: "body", place, target: `blocks.0.${target}`, spec });
const page = (key, spec) => ({ rule: "value", target: `pageLayout.${key}`, spec });

// Body places: Test 5 = 0-5 English paragraphs, 6 the table; Test 6 = 0-2 Hindi, 3-5 English, 6 "C12", 7 last line.
const added = {
  "EFFICIENCY TEST 5": [
    { instruction: "पूरे डॉक्यूमेंट में \"header\" शब्द को \"heading\" शब्द से Replace All कीजिए।",
      criteria: [{ rule: "text", kind: "body", find: "header", minCount: 0, maxCount: 0 }, { rule: "text", kind: "body", find: "heading", wholeWord: true, minCount: 4 }],
      solution: "1. HOME → **Replace** (Ctrl+H)।\n2. Find what **header**, Replace with **heading** → **Replace All**।\n\nजाँच: पैराग्राफों में कहीं भी \"header\" नहीं, चार जगह \"heading\"।" },
    { instruction: "चतुर्थ पैराग्राफ (Reading is easier…) को Change Case से Capitalize Each Word कीजिए।",
      criteria: [{ rule: "text", kind: "body", place: 3, find: "Reading Is Easier, Too, In The New Reading View", caseSensitive: true }, { rule: "text", kind: "body", place: 3, find: "Video Provides A Powerful Way To Help You Prove Your Point", caseSensitive: true }],
      solution: "1. चौथा पैराग्राफ (\"Reading is easier…\") पूरा सेलेक्ट करें।\n2. HOME → **Change Case (Aa ▾)** → **Capitalize Each Word**।\n\nजाँच: चौथे पैराग्राफ के हर शब्द का पहला अक्षर बड़ा।" },
    { instruction: "टेबल से ठीक पहले Page Break लगाइए, ताकि टेबल नए पेज पर आ जाए।",
      criteria: [value(6, "type", ["page-break"])],
      solution: "1. छठे (अंतिम) पैराग्राफ के अंत में क्लिक करें (टेबल से ठीक पहले)।\n2. INSERT → **Page Break** (Ctrl+Enter)।\n\nजाँच: टेबल अगले पेज पर।" },
    { instruction: "पेज का Orientation Landscape एवं Margins Moderate कीजिए।",
      criteria: [page("aspectRatio", { regex: "^(29\\.7 ?/ ?21|1\\.414 ?/ ?1)$" }), page("padding", ["25.4mm 19.1mm 25.4mm 19.1mm"])],
      solution: "1. PAGE LAYOUT → **Orientation ▾** → **Landscape**।\n2. PAGE LAYOUT → **Margins ▾** → **Moderate**।\n\nजाँच: पेज लैंडस्केप, ऊपर-नीचे 1\" और बाएँ-दाएँ 0.75\" मार्जिन।" },
    { instruction: "पेज पर \"SAMPLE\" वाटरमार्क (Custom Watermark) लगाइए।",
      criteria: [page("watermark", { regex: "^\\s*sample\\s*$" })],
      solution: "1. DESIGN → **Watermark ▾** → **Custom Watermark…**।\n2. **Text watermark** → Text में **SAMPLE** टाइप करें → **OK**।\n\nजाँच: पेज के बीच में हल्के अक्षरों में SAMPLE।" },
  ],
  "EFFICIENCY TEST 6": [
    { instruction: "चतुर्थ पैराग्राफ (Video provides…) को Justify अलाइनमेंट एवं लाइन स्पेसिंग 1.5 दीजिए।",
      criteria: [value(3, "alignment", ["justify"]), value(3, "attrs.lineHeight", ["1.5"])],
      solution: "चौथे पैराग्राफ में क्लिक करें:\n1. HOME → **Justify** (Ctrl+J)।\n2. HOME → **Line and Paragraph Spacing ▾** → **1.5**।\n\nजाँच: जस्टिफाई और लाइन स्पेसिंग 1.5।" },
    { instruction: "तृतीय पैराग्राफ में Hanging इंडेंट 0.5\" दीजिए।",
      criteria: [value(2, "attrs.specialIndentMode", ["hanging"]), value(2, "attrs.specialIndentAmount", { regex: "^(0\\.5\\d*in|0\\.49\\d*in|36pt|0\\.5\")$" })],
      solution: "1. तीसरे पैराग्राफ (\"रेलवे स्टेशन पर…\") में क्लिक करें।\n2. HOME → Paragraph ग्रुप **↘** → Indentation Special **Hanging**, By **0.5\"** → **OK**।\n\nजाँच: तीसरे पैराग्राफ की पहली लाइन को छोड़कर बाकी लाइनें 0.5\" अंदर।" },
    { instruction: "पूरे डॉक्यूमेंट में \"किसान\" शब्द को \"कृषक\" शब्द से Replace All कीजिए।",
      criteria: [{ rule: "text", kind: "body", find: "किसान", minCount: 0, maxCount: 0 }, { rule: "text", kind: "body", find: "कृषक", minCount: 2 }],
      solution: "1. HOME → **Replace** (Ctrl+H)।\n2. Find what **किसान**, Replace with **कृषक** → **Replace All**।\n\nजाँच: पहले और तीसरे पैराग्राफ में \"किसान\" की जगह \"कृषक\"।" },
    { instruction: "डॉक्यूमेंट के अंत में (अंतिम लाइन के बाद) 4 कॉलम एवं 3 रो की एक टेबल इन्सर्ट कीजिए।",
      criteria: [{ rule: "table", place: 0, columns: 4, rowCount: 3 }],
      solution: "1. अंतिम लाइन (\"This is you font group…\") के अंत में क्लिक करके Enter दबाएँ।\n2. INSERT → **Table ▾** → **Insert Table…** → Number of columns **4**, Number of rows **3** → **OK** (या ग्रिड में 4x3)।\n\nजाँच: अंत में 4 कॉलम × 3 रो की टेबल।" },
    { instruction: "पेज का Size Executive एवं Margins Narrow कीजिए।",
      criteria: [page("aspectRatio", { regex: "^18\\.41 ?/ ?26\\.67$" }), page("padding", ["12.7mm 12.7mm 12.7mm 12.7mm"])],
      solution: "1. PAGE LAYOUT → **Size ▾** → **Executive**।\n2. PAGE LAYOUT → **Margins ▾** → **Narrow**।\n\nजाँच: पेज Executive (7.25\" × 10.5\"), चारों मार्जिन 0.5\"।" },
  ],
};

const marks = (() => { const base = Math.floor((25 / 15) * 100) / 100; return Array.from({ length: 15 }, (_, i) => (i === 14 ? Math.round((25 - base * 14) * 100) / 100 : base)); })();
const dollar = (text) => { let tag = "$q$"; for (let i = 0; text.includes(tag); i++) tag = `$q${i}$`; return `${tag}${text}${tag}`; };
const emptyRun = { text: "", bold: false, italic: false, underline: false, strike: false, superscript: false, subscript: false, fontFamily: null, fontSize: null, color: null, highlight: null, field: null };
const pageBreak = { id: "block-pb-q13", type: "page-break", alignment: "left", runs: [emptyRun], attrs: { kind: "page" } };
const newTable = { id: "block-table-q14", type: "table", alignment: "left", runs: [{ text: "" }],
  attrs: { rows: [["", "", "", ""], ["", "", "", ""], ["", "", "", ""]], cellFormats: [[{}, {}, {}, {}], [{}, {}, {}, {}], [{}, {}, {}, {}]], tableLayout: "fixed" } };
// Test 5 Q1's headings in Kruti Dev, as a student types them (क्रम संख्या, विद्यार्थी का नाम, पिता का नाम, जन्म तिथि, मोबाइल नंबर).
const test5Headings = ["Øe la[;k", "fo|kFkhZ dk uke", "firk dk uke", "tUe frfFk", "eksckby uacj"];
const titleCase =(text) => text.replace(/\p{L}[\p{L}\p{M}]*/gu, (word) => word[0].toLocaleUpperCase() + word.slice(1).toLocaleLowerCase());

const papers = Object.entries(added).map(([title, questions]) => ` (${dollar(title)}, ${dollar(JSON.stringify(questions.map((q, i) => ({ number: 11 + i, ...q }))))}::jsonb)`).join(",\n");

const sql = `-- Hindi Word EFFICIENCY TEST 5 and TEST 6 up to 15 questions (8 Nov 2026). Each test gets a NEW version (earlier
-- attempts stay on their own version with their marks): the same practice document, the 10 questions and their checks
-- kept, marks spread so the paper is out of 25 (Test 5 was out of 12.5), and 5 new questions over the groups the paper did
-- not ask yet - HOME Editing (Replace), INSERT Pages / Table, DESIGN Page Background, PAGE LAYOUT Page Setup - with
-- hand-written checks and Hindi solutions. The Model Answer is carried over with the 5 new answers added (and Test 5's
-- Light Green page colour, which Q9 asks for), so results keep being published automatically. The questions are shown on
-- screen (the old PDF papers list only the first 10 questions; a new PDF can be uploaded on the admin page).
-- Generated by scripts/build-hindi-word-tests-5-6-fifteen.mjs. Safe to run twice (a test already at 15 questions is skipped).
begin;

-- The document with every body run's text replaced (header and footer untouched), as Replace All does.
create function pg_temp.body_replace(doc jsonb, needle text, replacement text) returns jsonb language sql as $f$
  select jsonb_set(doc, '{blocks}', (
    select jsonb_agg(case when b->>'type' in ('header', 'footer') or jsonb_typeof(b->'runs') <> 'array' then b
      else jsonb_set(b, '{runs}', coalesce((select jsonb_agg(case when r ? 'text' then jsonb_set(r, '{text}', to_jsonb(replace(r->>'text', needle, replacement))) else r end order by o)
                                             from jsonb_array_elements(b->'runs') with ordinality as y(r, o)), '[]'::jsonb)) end order by n)
      from jsonb_array_elements(doc->'blocks') with ordinality as x(b, n)))
$f$;
-- The document with a block put in at a 0-based position of doc.blocks.
create function pg_temp.insert_block(doc jsonb, pos integer, block jsonb) returns jsonb language sql as $f$
  select jsonb_set(doc, '{blocks}', (select jsonb_agg(e order by k) from (
      select b e, (n - 1)::numeric k from jsonb_array_elements(doc->'blocks') with ordinality as x(b, n)
      union all select block, pos - 0.5) s))
$f$;
-- The document with every run of block number pos (0-based) given the same settings.
create function pg_temp.patch_runs(doc jsonb, pos integer, patch jsonb) returns jsonb language sql as $f$
  select jsonb_set(doc, array['blocks', pos::text, 'runs'], (select jsonb_agg(r || patch order by o) from jsonb_array_elements(doc->'blocks'->pos->'runs') with ordinality as y(r, o)))
$f$;
-- The 0-based position of the first block of a type.
create function pg_temp.block_at(doc jsonb, kind text) returns integer language sql as $f$
  select (min(n) - 1)::integer from jsonb_array_elements(doc->'blocks') with ordinality as x(b, n) where b->>'type' = kind
$f$;

create temporary table added_questions (title text, questions jsonb) on commit drop;
insert into added_questions values
${papers};

do $$
declare p record; old record; new_id uuid; q jsonb; new_question uuid; model jsonb; marks numeric[] := array[${marks.join(", ")}]; block_pos integer;
begin
  for p in select * from added_questions loop
    select v.* into old from public.word_efficiency_tests t join public.word_efficiency_versions v on v.id = t.current_version_id
     where t.language = 'Hindi' and t.title = p.title;
    if old.id is null then raise exception 'Hindi Word % not found', p.title; end if;
    continue when (select count(*) from public.word_efficiency_questions where version_id = old.id) >= 15;
    if (select count(*) from public.word_efficiency_questions where version_id = old.id) <> 10 then raise exception 'Hindi Word % does not have 10 questions', p.title; end if;

    -- The Model Answer with the 5 new answers.
    model := old.model_answer_snapshot;
    if model is not null then
      if p.title = 'EFFICIENCY TEST 5' then
        -- The 10 original answers (the stored Model Answer had only some of them): Q1 table headings, Q2 data row
        -- format, Q4 character spacing, Q5 left+bottom border, Q7 bold centred page number, Q8 header centred, Q10 indents.
        block_pos := pg_temp.block_at(model, 'table');
        model := jsonb_set(model, array['blocks', block_pos::text, 'attrs', 'rows', '0'], ${dollar(JSON.stringify(test5Headings))}::jsonb);
        model := jsonb_set(model, array['blocks', block_pos::text, 'attrs', 'cellFormats', '1'], (select jsonb_agg(c || '{"bold":true,"italic":true,"color":"FF0000","fontSize":14}'::jsonb order by o)
          from jsonb_array_elements(model->'blocks'->block_pos->'attrs'->'cellFormats'->1) with ordinality as y(c, o)));
        model := jsonb_set(model, array['blocks', block_pos::text, 'runs'], (select jsonb_agg(case
            when o <= 5 then jsonb_set(r, '{text}', ${dollar(JSON.stringify(test5Headings))}::jsonb->(o::integer - 1))
            when o <= 10 then r || '{"bold":true,"italic":true,"color":"FF0000","fontSize":14}'::jsonb else r end order by o)
          from jsonb_array_elements(model->'blocks'->block_pos->'runs') with ordinality as y(r, o)));
        model := pg_temp.patch_runs(model, 1, '{"charSpacing":2.3}');
        model := jsonb_set(model, '{blocks,1,attrs,lineHeight}', '"1.25"');
        model := jsonb_set(model, '{blocks,2,attrs,border}', '"1px solid rgb(0, 0, 0) sides:bottom,left"');
        model := jsonb_set(model, '{blocks,3,attrs}', (model->'blocks'->3->'attrs') || '{"marginLeft":"0.23in","marginRight":"0.36in"}'::jsonb);
        model := pg_temp.patch_runs(model, pg_temp.block_at(model, 'footer'), '{"bold":true,"text":"2","field":"page-number|bottom|center"}');
        model := jsonb_set(model, array['blocks', pg_temp.block_at(model, 'footer')::text, 'alignment'], '"center"');
        model := jsonb_set(model, array['blocks', pg_temp.block_at(model, 'header')::text, 'alignment'], '"center"');
        -- The 5 new answers.
        model := pg_temp.body_replace(model, 'header', 'heading');
        block_pos := (select (n - 1)::integer from jsonb_array_elements(model->'blocks') with ordinality as x(b, n) where b->>'type' = 'paragraph' order by n offset 3 limit 1);
        model := jsonb_set(model, array['blocks', block_pos::text, 'runs'], (select jsonb_agg(jsonb_set(r, '{text}', to_jsonb(
            case when o = 1 then ${dollar(titleCase("Reading is easier, too, in the new Reading view. You can collapse parts of the document and focus on the text you want. If you need to stop reading before you reach the end, Word remembers where you left off - even on another device. Video provides a powerful way to help you prove your point."))} else '' end)) order by o)
          from jsonb_array_elements(model->'blocks'->block_pos->'runs') with ordinality as y(r, o)));
        model := pg_temp.insert_block(model, pg_temp.block_at(model, 'table'), ${dollar(JSON.stringify(pageBreak))}::jsonb);
        model := jsonb_set(model, '{pageLayout}', coalesce(model->'pageLayout', '{}'::jsonb) || ${dollar(JSON.stringify({ aspectRatio: "1.414 / 1", maxWidth: "1123px", padding: "25.4mm 19.1mm 25.4mm 19.1mm", backgroundColor: "92D050", watermark: "SAMPLE", watermarkFont: "Calibri", watermarkSize: "auto", watermarkColor: "C0C0C0", watermarkSemitransparent: "true", watermarkLayout: "diagonal" }))}::jsonb);
      else
        -- The 10 original answers (the stored Model Answer had only some of them): Q1 first paragraph, Q7 scale and
        -- spacing, Q8 kerning and position, Q9 C12, Q10 last paragraph. (Block 4 of this Model Answer is an empty line, which
        -- the checks do not count, so paragraphs 5-8 are blocks 5-8.)
        model := pg_temp.patch_runs(model, 0, '{"bold":true,"italic":true,"color":"F4B183","fontSize":10}');
        model := pg_temp.patch_runs(model, 5, '{"charScale":80,"charSpacing":2.5}');
        model := pg_temp.patch_runs(model, 6, '{"kerningEnabled":true,"kerningMin":3,"charPosition":-5}');
        model := jsonb_set(model, '{blocks,7,runs}', jsonb_build_array(
          (model->'blocks'->7->'runs'->0) || '{"text":"C","bold":true,"fontSize":15,"subscript":false}'::jsonb,
          (model->'blocks'->7->'runs'->0) || '{"text":"12","bold":true,"fontSize":15,"subscript":true}'::jsonb));
        model := pg_temp.patch_runs(model, 8, '{"bold":true,"fontSize":16,"highlight":"00FFFF"}');
        model := jsonb_set(model, '{blocks,8,alignment}', '"center"');
        -- The 5 new answers.
        model := pg_temp.body_replace(model, 'किसान', 'कृषक');
        model := jsonb_set(model, '{blocks,3,alignment}', '"justify"');
        model := jsonb_set(model, '{blocks,3,attrs,lineHeight}', '"1.5"');
        model := jsonb_set(model, '{blocks,2,attrs}', (model->'blocks'->2->'attrs') || '{"specialIndentMode":"hanging","specialIndentAmount":"0.5in"}'::jsonb);
        model := pg_temp.insert_block(model, coalesce(pg_temp.block_at(model, 'footer'), jsonb_array_length(model->'blocks')), ${dollar(JSON.stringify(newTable))}::jsonb);
        model := jsonb_set(model, '{pageLayout}', coalesce(model->'pageLayout', '{}'::jsonb) || '{"aspectRatio":"18.41 / 26.67","maxWidth":"696px","padding":"12.7mm 12.7mm 12.7mm 12.7mm"}'::jsonb);
      end if;
    end if;

    insert into public.word_efficiency_versions (test_id, version_number, title, language, description, instructions_markdown, delivery_onscreen, delivery_pdf, delivery_realfile,
        student_question_toggle, question_count, maximum_marks, duration_options, passing_marks, created_by, working_matter_snapshot, editor_capabilities, model_answer_snapshot)
    values (old.test_id, (select max(version_number) + 1 from public.word_efficiency_versions where test_id = old.test_id), old.title, old.language, old.description, old.instructions_markdown,
        true, false, false, old.student_question_toggle, 15, 25, old.duration_options, old.passing_marks, old.created_by,
        old.working_matter_snapshot, old.editor_capabilities, model)
    returning id into new_id;
    update public.word_efficiency_versions set model_answer_snapshot = model where id = new_id;

    -- The 10 questions and their checks, as they are, with the new marks.
    for q in select to_jsonb(o) from public.word_efficiency_questions o where o.version_id = old.id order by o.question_number loop
      insert into public.word_efficiency_questions (version_id, question_number, instruction, marks, sample_text, section, display_order, is_visible, grading_note, solution, solution_image)
      values (new_id, (q->>'question_number')::integer, q->>'instruction', marks[(q->>'question_number')::integer], q->>'sample_text', q->>'section', (q->>'display_order')::integer,
              (q->>'is_visible')::boolean, q->>'grading_note', q->>'solution', q->>'solution_image')
      returning id into new_question;
      insert into public.word_efficiency_grading_rules (version_id, question_id, exact_target, expected_operation, expected_value, allocated_marks, partial_marks, additional_criteria, part_label)
      select new_id, new_question, r.exact_target, r.expected_operation, r.expected_value,
             round(r.allocated_marks * marks[(q->>'question_number')::integer] / nullif((q->>'marks')::numeric, 0), 2), r.partial_marks, r.additional_criteria, r.part_label
        from public.word_efficiency_grading_rules r where r.question_id = (q->>'id')::uuid;
    end loop;

    -- The 5 new questions.
    for q in select value from jsonb_array_elements(p.questions) loop
      insert into public.word_efficiency_questions (version_id, question_number, instruction, marks, section, display_order, is_visible, solution)
      values (new_id, (q->>'number')::integer, q->>'instruction', marks[(q->>'number')::integer], null, (q->>'number')::integer, true, q->>'solution')
      returning id into new_question;
      insert into public.word_efficiency_grading_rules (version_id, question_id, exact_target, expected_operation, expected_value, allocated_marks, partial_marks, additional_criteria, part_label)
      values (new_id, new_question, 'rule', 'model-answer-match-v2', 'null'::jsonb, marks[(q->>'number')::integer], null, q->'criteria', null);
    end loop;

    update public.word_efficiency_tests set current_version_id = new_id, current_version_number = (select version_number from public.word_efficiency_versions where id = new_id), updated_at = now()
     where id = old.test_id;
  end loop;
end $$;

-- Check: 15 questions out of 25; the Model Answer earns every mark, the untouched paper none.
select t.title, t.current_version_number, count(q.id) questions, sum(q.marks) total,
       sum((public.word_efficiency_score_question(v.model_answer_snapshot, v.id, q.id, q.marks, v.model_answer_snapshot)).awarded) model_answer_gets,
       sum((public.word_efficiency_score_question(public.word_efficiency_initial_editor_document(v.working_matter_snapshot), v.id, q.id, q.marks, v.model_answer_snapshot)).awarded) untouched_paper_gets
  from public.word_efficiency_tests t join public.word_efficiency_versions v on v.id = t.current_version_id join public.word_efficiency_questions q on q.version_id = v.id
 where t.language = 'Hindi' and t.title in ('EFFICIENCY TEST 5', 'EFFICIENCY TEST 6') group by t.title, t.current_version_number order by t.title;

commit;
`;
writeFileSync("supabase/migrations/202611081200_hindi_word_tests_5_6_fifteen_questions.sql", sql);
console.log(sql.length);
