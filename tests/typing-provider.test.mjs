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
