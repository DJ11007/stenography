import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = async (path) => (await readFile(new URL(path, import.meta.url), "utf8")).replace(/\r\n/g, "\n");

// The admin decides whether Word students may hide/show the on-screen questions, as Excel already allowed.
test("Word admin form, save action, start page and workspace follow the hide/show setting", async () => {
  const fields = await read("../app/admin/word-efficiency-tests/delivery-pdf-fields.tsx");
  assert.match(fields, /\{\(subject==="word"\|\|onscreen\)&&<label className="ml-7 mt-2 flex gap-3 text-sm"><input type="checkbox" name="studentQuestionToggle" defaultChecked=\{defaultStudentToggle\}\/> Students can hide or show the questions/);
  const page = await read("../app/admin/word-efficiency-tests/tests-page.tsx");
  assert.match(page, /defaultStudentToggle=\{\(current as \{ student_question_toggle\?: boolean \} \| undefined\)\?\.student_question_toggle !== false\}/);
  const actions = await read("../app/admin/word-efficiency-tests/actions.ts");
  assert.match(actions, /supabase\.rpc\("set_word_efficiency_question_toggle",\{p_test_id:savedId,p_student_toggle:studentToggle\}\)/);
  const launch = await read("../app/typing/word-efficiency/[language]/[testId]/instructions/student-test-launch.tsx");
  assert.match(launch, /\{studentToggle\?<>.*name="showQuestions".*<\/>:<input type="hidden" name="showQuestions" value="on"\/>\}/s);
  const instructions = await read("../app/typing/word-efficiency/[language]/[testId]/instructions/page.tsx");
  assert.match(instructions, /studentToggle=\{\(version as \{student_question_toggle\?:boolean\}\)\.student_question_toggle!==false\}/);
  const workspace = await read("../app/typing/word-efficiency/[language]/[testId]/workspace/word-workspace.tsx");
  assert.match(workspace, /const canToggle=snapshot\.question_toggle!==false;const\[showQuestions,setShowQuestions\]=useState\(Boolean\(snapshot\.show_questions\)\|\|!canToggle\);/);
  assert.match(workspace, /onToggle=\{canToggle\?toggleQuestions:undefined\}/);
  const migration = await read("../supabase/migrations/202611071200_word_efficiency_student_question_toggle.sql");
  assert.match(migration, /add column if not exists student_question_toggle boolean not null default true/);
  assert.match(migration, /'show_questions',coalesce\(p_show_questions,false\) or not coalesce\(/);
});
