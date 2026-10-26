import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

// The admin decides whether Excel questions are on screen and whether the student may hide/show them.
test("Excel question delivery: admin settings, enforced when the attempt starts and in the workspace", async () => {
  const [box, action, launch, workspace, sql] = await Promise.all([
    read("app/admin/word-efficiency-tests/delivery-pdf-fields.tsx"),
    read("app/admin/excel-efficiency-tests/actions.ts"),
    read("app/typing/excel-efficiency/[language]/[testId]/instructions/student-test-launch.tsx"),
    read("app/typing/excel-efficiency/[language]/[testId]/workspace/excel-workspace.tsx"),
    read("supabase/migrations/202610252100_excel_efficiency_question_display_settings.sql"),
  ]);
  assert.doesNotMatch(box, /checked disabled/, "On-screen questions is no longer locked on");
  assert.match(box, /name="studentQuestionToggle" defaultChecked=\{defaultStudentToggle\}/);
  assert.match(action, /rpc\("set_excel_efficiency_question_display", \{ p_test_id: savedId, p_onscreen: form\.get\("deliveryOnscreen"\) === "on", p_student_toggle: form\.get\("studentQuestionToggle"\) === "on" \}\)/);
  assert.match(launch, /\{studentToggle \? \(/);
  assert.match(workspace, /onToggle=\{canToggle \?/);
  assert.match(sql, /when not v\.delivery_onscreen then false when not v\.student_question_toggle then true else coalesce\(p_show_questions,true\) end/);
  assert.match(sql, /Students need the questions/);
});
