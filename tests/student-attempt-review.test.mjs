import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

// Real reported gap: there was no student-facing "view my own past attempt
// in full" page for Typing/Stenography anywhere on the site -- only a
// summary card list (/student/results) and, for admins only,
// /admin/students/attempts/[attemptId]. This new page mirrors that admin
// page's snapshot-rebuild logic exactly, but under app/typing/ (so it
// inherits /typing/layout.tsx's TypingStudentProvider for free -- the
// admin page had to add its own wrapper since it lives outside that
// layout) and scoped to the CURRENT student's own attempt: the query is
// filtered by student_id, and createClient()'s normal RLS additionally
// enforces the same "Students read own attempts" policy every other
// student-facing query already relies on -- a live attempt whose
// results_publish_at hasn't passed yet simply returns no row, 404ing here
// exactly as it's invisible everywhere else, with no separate check needed.

test("the student attempt-review page requires a student, scopes the query to their own attempt, and 404s otherwise", async () => {
  const page = await read("app/typing/attempts/[attemptId]/page.tsx");
  assert.match(page, /const \{ user \} = await requireStudent\(\);/);
  assert.match(page, /\.eq\("id", attemptId\)\.eq\("student_id", user\.id\)\.maybeSingle\(\);/);
  assert.match(page, /if \(!attempt\) notFound\(\);/);
});

test("the student attempt-review page reuses the exact same AttemptReviewClient/snapshot-rebuild the admin page uses, linking back to /student/results", async () => {
  const page = await read("app/typing/attempts/[attemptId]/page.tsx");
  assert.match(page, /import \{ AttemptReviewClient \} from "@\/app\/admin\/students\/attempts\/\[attemptId\]\/attempt-review-client";/);
  assert.match(page, /managedVersionToPreset\(version, examCategorySlug\)/);
  assert.match(page, /calculateTypingScore\(\{/);
  assert.match(page, /returnHref="\/student\/results"/);
});

test("the page lives under app/typing so it inherits TypingStudentProvider from app/typing/layout.tsx instead of needing its own wrapper", async () => {
  const page = await read("app/typing/attempts/[attemptId]/page.tsx");
  assert.doesNotMatch(page, /TypingStudentProvider/);
});
