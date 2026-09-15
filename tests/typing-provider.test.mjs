import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const projectRoot = process.cwd();

async function source(relativePath) {
  return readFile(path.join(projectRoot, relativePath), "utf8");
}

async function filesBelow(relativeDirectory) {
  const directory = path.join(projectRoot, relativeDirectory);
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const relativePath = path.join(relativeDirectory, entry.name);
      return entry.isDirectory() ? filesBelow(relativePath) : [relativePath];
    }),
  );

  return files.flat();
}

test("the root layout provides one shared typing-platform context", async () => {
  const layoutFiles = (await filesBelow("app")).filter((file) =>
    /(?:^|[\\/])layout\.tsx$/.test(file),
  );
  const layouts = await Promise.all(layoutFiles.map((file) => source(file)));
  const providerInstances = layouts.reduce(
    (count, contents) =>
      count + (contents.match(/<TypingPlatformProvider(?:\s|>)/g) ?? []).length,
    0,
  );
  const rootLayout = await source("app/layout.tsx");
  const typingLayout = await source("app/typing/layout.tsx");

  assert.match(rootLayout, /import\s+\{\s*TypingPlatformProvider\s*\}/);
  assert.match(
    rootLayout,
    /<TypingPlatformProvider>\s*\{children\}\s*<\/TypingPlatformProvider>/,
  );
  assert.equal(providerInstances, 1, "layouts must mount exactly one provider");
  assert.doesNotMatch(typingLayout, /TypingPlatformProvider/);
});

test("published managed tests render the configurable exam under the root provider", async () => {
  const publishedTestPage = await source("app/tests/[slug]/page.tsx");
  const rootLayout = await source("app/layout.tsx");
  const settings = await source("lib/typing-platform-settings.ts");

  assert.match(publishedTestPage, /ConfigurableTypingExam/);
  assert.match(rootLayout, /TypingPlatformProvider/);
  assert.match(
    settings,
    /samradhi-typing-platform-settings-v2/,
    "the existing versioned preference store must remain unchanged",
  );
});

test("every typing-platform settings hook consumer is covered by the root layout", async () => {
  const appFiles = (await filesBelow("app")).filter((file) => /\.tsx$/.test(file));
  const consumers = [];

  for (const file of appFiles) {
    const contents = await source(file);
    if (
      contents.includes("useTypingPlatformSettings(") &&
      !file.endsWith("typing-platform-provider.tsx")
    ) {
      consumers.push(file);
    }
  }

  assert.ok(consumers.length > 0, "expected at least one hook consumer");
  assert.match(await source("app/layout.tsx"), /TypingPlatformProvider/);
  assert.ok(
    consumers.every((file) => file.startsWith(`app${path.sep}`)),
    `hook consumers outside the root provider: ${consumers.join(", ")}`,
  );
});

// Regression test for a real crash: unlike TypingPlatformProvider (mounted
// once at the root layout, so every route gets it for free),
// TypingStudentProvider is only mounted by app/typing/layout.tsx --
// useTypingStudent() (used by TypingBrandHeader, which ConfigurableTypingExam
// renders in every state) throws "Typing student context is unavailable."
// anywhere that renders that header outside the /typing route tree.
// app/tests/[slug]/page.tsx is exactly that: a sibling top-level route that
// still renders ConfigurableTypingExam for exam/learn/live tests (practice
// and stenography tests redirect into /typing/practice/... instead, which
// *is* covered by the layout). Every useTypingStudent() consumer must
// either live under app/typing/ (covered by that layout) or supply its own
// TypingStudentProvider, like this route now does.
test("every useTypingStudent() consumer is covered by app/typing/layout.tsx or supplies its own TypingStudentProvider", async () => {
  const appFiles = (await filesBelow("app")).filter((file) => /\.tsx$/.test(file));
  const consumers = [];
  for (const file of appFiles) {
    const contents = await source(file);
    if (contents.includes("useTypingStudent(") && !file.endsWith("typing-student-provider.tsx")) consumers.push(file);
  }
  assert.ok(consumers.length > 0, "expected at least one hook consumer");
  const typingRoot = `app${path.sep}typing${path.sep}`;
  const outsideTypingLayout = consumers.filter((file) => !file.includes(typingRoot));
  for (const file of outsideTypingLayout) {
    const contents = await source(file);
    assert.match(
      contents,
      /TypingStudentProvider/,
      `${file} renders a useTypingStudent() consumer outside app/typing/ without its own TypingStudentProvider`,
    );
  }
});

test("app/tests/[slug]/page.tsx requires a signed-in user (any role) and wraps the exam workspace in its own TypingStudentProvider", async () => {
  const page = await source("app/tests/[slug]/page.tsx");
  assert.match(page, /import \{ TypingStudentProvider \} from "@\/app\/typing\/_components\/typing-student-provider";/);
  assert.match(page, /if\(!user\)redirect\(`\/login\?next=\$\{encodeURIComponent\(`\/tests\/\$\{slug\}`\)\}`\);/);
  assert.match(page, /const studentIdentity=\{name:profile\?\.full_name\?\.trim\(\)\|\|"Student",email:user\.email\|\|"",phone:profile\?\.phone\|\|user\.phone\|\|null\};/);
  assert.match(page, /<TypingStudentProvider student=\{studentIdentity\}>/);
  // Not requireStudent() -- an admin must still be able to open this exact
  // link to preview/trial their own just-published test, not get bounced
  // to /admin.
  assert.doesNotMatch(page, /requireStudent/);
});

// Real reported runtime error: "Typing student context is unavailable" --
// FreeExamLimitPaywall renders TypingBrandHeader, which calls
// useTypingStudent() same as the exam workspace does, but this early
// return used to skip the TypingStudentProvider wrap entirely (it only
// wrapped the final return), so the whole page 500s for any student who
// has actually used up their free exam attempts.
test("the FreeExamLimitPaywall early return is also wrapped in TypingStudentProvider, not just the final exam-workspace return", async () => {
  const page = await source("app/tests/[slug]/page.tsx");
  assert.match(page, /if\(examFreeStatus\.data\?\.blocked\)return <TypingStudentProvider student=\{studentIdentity\}><FreeExamLimitPaywall used=\{examFreeStatus\.data\.used_count\} limit=\{examFreeStatus\.data\.free_limit\?\?0\}\/><\/TypingStudentProvider>;/);
});
