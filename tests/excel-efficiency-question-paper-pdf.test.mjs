import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

// Requested: Excel Efficiency tests take a question paper PDF the same way Word Efficiency tests do.
test("the Excel admin form uploads the question paper PDF, keeps it across saves and can read its questions", async () => {
  const [panel, actions, page, editor] = await Promise.all([
    read("app/admin/excel-efficiency-tests/extract-questions-pdf.tsx"), read("app/admin/excel-efficiency-tests/actions.ts"),
    read("app/admin/excel-efficiency-tests/page.tsx"), read("app/admin/excel-efficiency-tests/question-editor.tsx")]);
  assert.match(panel, /<input type="checkbox" name="deliveryPdf"/);
  assert.match(panel, /type="file" name="pdfFile"/);
  assert.match(panel, /name="removePdf"/);
  assert.match(panel, /extractExcelEfficiencyPdf\(data\)/);
  assert.match(panel, /new CustomEvent\("excel-efficiency:questions-import"/);
  assert.match(editor, /window\.addEventListener\("excel-efficiency:questions-import", receive\)/);
  assert.match(page, /<ExtractQuestionsPdf defaultDeliveryPdf=\{Boolean\(current\?\.delivery_pdf\)\}/);
  assert.match(actions, /supabase\.storage\.from\("excel-efficiency-pdfs"\)\.upload\(path, bytes/);
  assert.match(actions, /if \(previous\?\.pdf_path\) pdfMeta = previous;/, "a re-save keeps the PDF");
  assert.match(actions, /supabase\.rpc\("set_excel_efficiency_question_paper", \{ p_test_id: savedId, p_delivery_pdf: deliveryPdf/);
  assert.match(actions, /export async function extractExcelEfficiencyPdf\(form: FormData\)/);
});

test("students download the Excel question paper from the instructions page; storage lets only active students read the current published PDF", async () => {
  const [route, launch, page, sql] = await Promise.all([
    read("app/typing/excel-efficiency/[language]/[testId]/question-paper/route.ts"),
    read("app/typing/excel-efficiency/[language]/[testId]/instructions/student-test-launch.tsx"),
    read("app/typing/excel-efficiency/[language]/[testId]/instructions/page.tsx"),
    read("supabase/migrations/202610251600_excel_efficiency_question_paper_pdf.sql")]);
  assert.match(route, /await requireStudent\(\);/);
  assert.match(route, /if \(!version\?\.delivery_pdf \|\| !version\.pdf_path\) return new NextResponse\("Question paper unavailable", \{ status: 404 \}\);/);
  assert.match(route, /storage\.from\("excel-efficiency-pdfs"\)\.createSignedUrl\(version\.pdf_path, 60/);
  assert.match(launch, /\{hasPdf && \(/);
  assert.match(launch, /href=\{`\/typing\/excel-efficiency\/\$\{language\}\/\$\{testId\}\/question-paper`\}/);
  assert.match(page, /const hasPdf = Boolean\(version\.delivery_pdf && version\.pdf_path\);/);
  assert.match(sql, /values \('excel-efficiency-pdfs', 'excel-efficiency-pdfs', false, 15728640, array\['application\/pdf'\]\)/);
  assert.match(sql, /create policy "Students read current published Excel PDF"/);
  assert.match(sql, /if not public\.is_aal2_admin\(\) then raise exception 'not authorized'; end if;/);
});
