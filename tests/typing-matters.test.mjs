import test from "node:test";
import assert from "node:assert/strict";
import { createMatter, validateDurationMinutes, validateMatterFile, validateMatterText } from "../lib/typing-matters.ts";

test("validates matter files and rejects executable or unsupported input",()=>{assert.equal(validateMatterFile({name:"matter.txt",size:100,type:"text/plain"}),null);assert.match(validateMatterFile({name:"run.js",size:100,type:"text/javascript"}),/Executable/);assert.match(validateMatterFile({name:"matter.pdf",size:100,type:"application/pdf"}),/Only .txt/);assert.match(validateMatterFile({name:"matter.docx",size:100,type:"application/vnd.openxmlformats-officedocument.wordprocessingml.document"}),/not enabled/)});
test("detects Unicode and Kruti Dev mismatches without conversion",()=>{assert.match(validateMatterText("शिक्षा भारत", "Hindi", "hindi-krutidev-010").errors.join(" "),/Convert to Kruti Dev/);assert.match(validateMatterText("f'k{kk O;fDr", "Hindi", "hindi-unicode-inscript").errors.join(" "),/Convert to Unicode/)});

// Real reported bug, recurring: an admin saving Kruti Dev text containing
// ligature bytes (e.g. stored "g®A" renders as "हो." on screen but
// decodes/scores as "हैं.") used to save byte-for-byte as typed, so the
// bug kept coming back every time someone re-saved that test's passage
// through the admin form -- this is the one save-time choke point every
// such edit passes through, so cleaning it here is what makes the fix
// permanent instead of a one-off SQL cleanup that needs re-running.
test("validateMatterText automatically folds Kruti Dev ligature bytes into their safe keyboard-typeable form", () => {
  const result = validateMatterText("g®A", "Hindi", "hindi-krutidev-010");
  assert.deepEqual(result.errors, []);
  assert.equal(result.text, "gSaA");
  assert.equal(result.characterCount, "gSaA".length);
});

test("validateMatterText leaves already-clean Kruti Dev text and every non-Kruti-Dev input completely unchanged", () => {
  assert.equal(validateMatterText("gSaA", "Hindi", "hindi-krutidev-010").text, "gSaA");
  assert.equal(validateMatterText("Hello world", "English", "english-qwerty").text, "Hello world");
});
test("creates a normalized local matter while preserving paragraphs",()=>{const matter=createMatter({title:"My Test",language:"English",mode:"practice",inputSystemId:"english-qwerty",passage:"First line.\r\n\r\nSecond line!",durationSeconds:600,requiredWpm:35,requiredAccuracy:90,backspaceMode:"full",wordMethod:"characters",highlightMode:"word",visibility:"private"},"matter-1","2026-01-01T00:00:00.000Z");assert.equal(matter.id,"matter-1");assert.equal(matter.passage,"First line.\n\nSecond line!");assert.equal(matter.mode,"practice")});
test("matter duration validation uses a safe one-to-sixty-minute range",()=>{assert.equal(validateDurationMinutes(1),1);assert.equal(validateDurationMinutes(60),60);assert.equal(validateDurationMinutes(90),10);assert.equal(validateDurationMinutes("10"),10)});
