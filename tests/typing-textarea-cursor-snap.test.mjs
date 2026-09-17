import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

// Real reported bug: a student scrolling the Original Passage panel back up
// to re-read something, then clicking into Type Here to resume, got the
// cursor wherever they happened to click (the textarea's own native
// behavior) -- not necessarily at the end of what they'd already typed.
// Typing then resumed from that arbitrary click point instead of
// appending, silently inserting new keystrokes into the middle of
// already-typed text. A real exam is sequential, so every click snaps the
// cursor back to the end regardless of where in the box was clicked.
test("clicking anywhere in the Type Here textarea snaps the cursor to the end of the typed text instead of leaving it at the click position", async () => {
  const source = await read("app/typing/_components/configurable-typing-exam.tsx");
  assert.match(source, /const snapCursorToEnd = \(event: React\.MouseEvent<HTMLTextAreaElement>\) => \{ const target = event\.currentTarget; target\.setSelectionRange\(target\.value\.length, target\.value\.length\); \};/);
  assert.match(source, /<textarea disabled=\{fontAvailable !== true \|\| paused\} ref=\{textareaRef\} autoFocus value=\{typedText\} onChange=\{\(event\) => handleChange\(event\.target\.value\)\} onKeyDown=\{keyDown\} onBeforeInput=\{beforeInput\} onClick=\{snapCursorToEnd\}/);
});
