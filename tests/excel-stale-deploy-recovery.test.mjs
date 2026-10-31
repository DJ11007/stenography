import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const sheet = async () => (await read("app/typing/excel-efficiency/[language]/[testId]/workspace/rich-sheet-editor.tsx")).replace(/\r\n/g, "\n");

// Every deploy gives Server Actions new ids, so an Excel page (student attempt or admin Model Answer) opened before
// a deploy got a 404 "Server Action ... was not found" on its next save (node_modules/next/dist/docs/01-app/
// 02-guides/server-actions.md, "Deployment considerations": surface it as a retry path, not a hard failure).

test("autosave and Save catch a stale deploy: the sheet is kept in the tab and the page reloads once by itself", async () => {
  const source = await sheet();
  assert.match(source, /import \{ isStaleServerActionError \} from "@\/lib\/pending-attempts";/);
  assert.match(source, /if \(isStaleServerActionError\(error\)\) \{ setStatus\("This page was updated\. Reloading to save your work…"\); recoverFromDeploy\(document\); return; \}/);
  assert.match(source, /keepUnsaved\(document\);\n\s+setStaleDeploy\(true\);/);
  assert.match(source, /if \(!recent\) window\.location\.reload\(\);/);
  assert.match(source, /const saveNow = async \(\) => \{ if \(submitted\) return; if \(autosaveTimer\.current\) clearTimeout\(autosaveTimer\.current\); void saveDocument\(\); \};/);
});

test("after the reload the kept sheet is put back and saved again, unless the saved sheet is newer", async () => {
  const source = await sheet();
  assert.match(source, /if \(!kept \|\| locked \|\| \(start\.savedAt && kept\.savedAt <= start\.savedAt\)\) \{ clearUnsaved\(\); return; \}/);
  assert.match(source, /setRevision\(\(current\) => current \+ 1\);\n\s+setStatus\("Your unsaved work was put back\. Saving…"\);/);
});

test("a stale submit or Save answer says to refresh and shows a Refresh page button", async () => {
  const source = await sheet();
  assert.match(source, /if \(isStaleServerActionError\(error\)\) \{ setStaleDeploy\(true\); return fail\("This page was updated on the server\./);
  assert.match(source, /\{staleDeploy && <button type="button" onClick=\{\(\) => window\.location\.reload\(\)\}/);
});

test("form actions on the Excel pages land on an error screen that reloads a stale page instead of a dead end", async () => {
  for (const path of ["app/typing/excel-efficiency/error.tsx", "app/admin/excel-efficiency-tests/error.tsx"]) {
    assert.match(await read(path), /export \{ EfficiencyRouteError as default \} from "@\/components\/efficiency\/efficiency-route-error";/);
  }
  const screen = await read("components/efficiency/efficiency-route-error.tsx");
  assert.match(screen, /const stale = isStaleServerActionError\(error\);/);
  assert.match(screen, /if \(!recent\) window\.location\.reload\(\);/);
  const model = await read("app/admin/excel-efficiency-tests/[testId]/model-answer/model-answer-editor.tsx");
  assert.match(model, /resetExcelEfficiencyModelAnswer\(versionId\)\.catch\(/);
});
