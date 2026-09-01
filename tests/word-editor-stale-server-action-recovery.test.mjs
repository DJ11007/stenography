import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = () => readFile(new URL("../app/typing/word-efficiency/[language]/[testId]/workspace/rich-document-editor.tsx", import.meta.url), "utf8");

// Next.js rotates each Server Action's id on every deploy (documented in
// this project's own node_modules/next/dist/docs/01-app/02-guides/
// server-actions.md, "Deployment considerations"), so a page a student
// already had open when a newer version went live still holds a
// now-unrecognized action id -- surfacing as "Server Action "<id>" was
// not found on the server" (this is what the user reported after clicking
// Clear Formatting: it happened to be the first autosave-triggering click
// on a page that had gone stale, not a bug in Clear Formatting itself).
// The docs' own recommendation is to surface this as a retry path rather
// than a hard failure.

test("a stale Server Action id is detected by message shape, not by exact hash, so it matches any deploy's rotated id", async () => {
  const source = await read();
  assert.match(source, /function isStaleServerActionError\(error:unknown\)\{return error instanceof Error&&\/Server Action "\.\*" was not found on the server\/\.test\(error\.message\)\}/);
});

test("an autosave failure caused by a stale deploy sets a friendly, actionable status instead of the raw Next.js error text", async () => {
  const source = await read();
  assert.match(source, /if\(isStaleServerActionError\(error\)\)\{setStaleDeploy\(true\);setStatus\("A newer version of this page was published\. Refresh to continue -- your last saved autosave is safe\."\);return\}/);
});

test("a submission failure caused by a stale deploy also gets a friendly, actionable status", async () => {
  const source = await read();
  assert.match(source, /if\(isStaleServerActionError\(error\)\)\{setStaleDeploy\(true\);setStatus\("A newer version of this page was published\. Refresh, then try submitting again -- nothing was lost\."\);return\}/);
});

test("a visible Refresh page button appears in the footer once a stale deploy is detected, giving the documented retry path", async () => {
  const source = await read();
  assert.match(source, /\{staleDeploy&&<button type="button" onClick=\{\(\)=>window\.location\.reload\(\)\}[^>]*>Refresh page<\/button>\}/);
});
