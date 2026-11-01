import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { liveExamResultsCsv } from "../lib/live-exam.ts";

// Live Exam Center step 4 (results sheet, the student's own result) and student photos.
const read = async (path) => (await readFile(new URL(`../${path}`, import.meta.url), "utf8")).replace(/\r\n/g, "\n");
const LDC = [{ label: "Hindi Typing", maxMarks: 25 }, { label: "English Typing", maxMarks: 25 }, { label: "Word Efficiency", maxMarks: 25 }, { label: "Excel Efficiency", maxMarks: 25 }];

test("results sheet: each section with its maximum as a heading, then Total (100); best total first, ties share a rank", () => {
  const csv = liveExamResultsCsv(LDC, [
    { student_id: "a", student_name: "Rupendra", email: "r@x.com", total: 70.5, section_marks: [{ position: 1, marks: 20 }, { position: 2, marks: 18.5 }, { position: 3, marks: 20 }, { position: 4, marks: 12 }] },
    { student_id: "b", student_name: "Lokesh, D", email: "l@x.com", total: 70.5, section_marks: [{ position: 1, marks: 25 }, { position: 2, marks: null }, { position: 3, marks: 25 }, { position: 4, marks: 20.5 }] },
    { student_id: "c", student_name: "Asha", total: 30, section_marks: [{ position: 1, marks: 25 }, { position: 3, marks: 5 }] },
  ]);
  assert.ok(csv.startsWith("﻿"), "a BOM, so Excel shows Hindi names");
  assert.deepEqual(csv.slice(1).trim().split("\r\n"), [
    "Rank,Name,Login ID,Hindi Typing (25),English Typing (25),Word Efficiency (25),Excel Efficiency (25),Total (100)",
    '1,"Lokesh, D",l@x.com,25,,25,20.5,70.5',
    "1,Rupendra,r@x.com,20,18.5,20,12,70.5",
    "3,Asha,,25,,5,,30",
  ]);
});

test("the admin page lists the results and downloads them; the download is admin-only", async () => {
  const page = await read("app/admin/live-exams/page.tsx");
  assert.match(page, /\{editing && <ExamResults examId=\{editing\.id\} \/>\}/);
  assert.match(page, /href=\{`\/admin\/live-exams\/\$\{examId\}\/results\.csv`\}/);
  const route = await read("app/admin/live-exams/[examId]/results.csv/route.ts");
  assert.match(route, /await requireAdmin\(\);/);
  assert.match(route, /"Content-Disposition": `attachment; filename="\$\{name\}-results\.csv"`/);
});

test("after the exam the student sees their own marks once results are open", async () => {
  const room = await read("app/live-exam/[examId]/live-exam-room.tsx");
  assert.match(room, /\{!preview && \(!state\.resultsAt \|\| now >= Date\.parse\(state\.resultsAt\)\)\n\s+\? <OwnResult examId=\{state\.id\} sections=\{state\.sections\} \/>/);
  assert.match(room, /createClient\(\)\.from\("live_exam_section_attempts"\)\.select\("section_id,marks"\)\.eq\("exam_id", examId\)/);
});

test("photos: a private bucket, a student only in their own folder, an admin anyone's, shown on the exam screen", async () => {
  const migration = await read("supabase/migrations/202611011100_student_photos.sql");
  assert.match(migration, /values \('student-photos', 'student-photos', false, 2097152, array\['image\/jpeg', 'image\/png', 'image\/webp'\]\)/);
  assert.match(migration, /using \(bucket_id = 'student-photos' and \(storage\.foldername\(name\)\)\[1\] = auth\.uid\(\)::text\)/);
  assert.match(migration, /if auth\.uid\(\) is null or \(p_student_id <> auth\.uid\(\) and not public\.is_aal2_admin\(\)\) then raise exception 'not authorized'; end if;/);
  const upload = await read("components/student-photo-upload.tsx");
  assert.match(upload, /const path = `\$\{studentId\}\/photo-\$\{Date\.now\(\)\}\.\$\{extension\}`;/);
  assert.match(upload, /if \(file\.size > 2 \* 1024 \* 1024\)/);
  for (const page of ["app/student/profile/page.tsx", "app/admin/students/[id]/page.tsx"]) assert.match(await read(page), /<StudentPhotoUpload studentId=/);
  assert.match(await read("app/live-exam/[examId]/page.tsx"), /photoUrl: await studentPhotoUrl\(supabase, user\.id\)/);
});

test("the Live Test page links to the new Live Exam page", async () => {
  assert.match(await read("app/live-test/page.tsx"), /<a href="\/live-exam"/);
});
