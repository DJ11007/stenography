import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

// Requested: Excel Efficiency tests take a question paper PDF the same way Word Efficiency tests do,
// with the Word page's "Question Delivery and PDF" box and question editor.
test("the Excel admin page has the Word page's Question Delivery and PDF box and question editor", async () => {
  const [box, actions, page, editor, adminPdf] = await Promise.all([
    read("app/admin/word-efficiency-tests/delivery-pdf-fields.tsx"), read("app/admin/excel-efficiency-tests/actions.ts"),
    read("app/admin/excel-efficiency-tests/page.tsx"), read("app/admin/excel-efficiency-tests/question-editor.tsx"),
    read("app/admin/excel-efficiency-tests/[testId]/pdf/route.ts")]);
  assert.match(page, /<DeliveryPdfFields subject="excel" defaultOnscreen defaultPdf=\{Boolean\(current\?\.delivery_pdf\)\}/);
  assert.match(box, /const extractPdf=subject==="excel"\?extractExcelEfficiencyPdf:extractWordEfficiencyPdf;/);
  assert.match(box, /new CustomEvent\(`\$\{subject\}-efficiency:questions-import`/);
  assert.match(box, /href=\{`\/admin\/\$\{subject\}-efficiency-tests\/\$\{existingPdf\.testId\}\/pdf`\}/);
  assert.match(adminPdf, /storage\.from\("excel-efficiency-pdfs"\)\.createSignedUrl\(version\.pdf_path, 60\)/);
  assert.match(editor, /window\.addEventListener\("excel-efficiency:questions-import", receive\)/);
  assert.match(editor, /Select all \(\{questions\.filter/);
  assert.match(editor, /Distribute total marks equally/);
  assert.match(editor, /typing=\{typing\} onTypingChange=\{setTyping\}/);
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
  assert.match(launch, /Private question paper PDF/);
  assert.match(launch, /href=\{`\/typing\/excel-efficiency\/\$\{language\}\/\$\{testId\}\/question-paper`\}/);
  assert.match(page, /const hasPdf = Boolean\(version\.delivery_pdf && version\.pdf_path\);/);
  assert.match(sql, /values \('excel-efficiency-pdfs', 'excel-efficiency-pdfs', false, 15728640, array\['application\/pdf'\]\)/);
  assert.match(sql, /create policy "Students read current published Excel PDF"/);
  assert.match(sql, /if not public\.is_aal2_admin\(\) then raise exception 'not authorized'; end if;/);
});
