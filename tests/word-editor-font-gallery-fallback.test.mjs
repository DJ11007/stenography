import assert from "node:assert/strict";
import test from "node:test";
import { APPROVED_WORD_FONTS, normalizeWordEditorCapabilities } from "../lib/word-editor-capabilities.ts";

// A version whose stored editor_capabilities has no usable `fonts` array
// (missing entirely, null, or empty) used to fall back to a narrow
// hardcoded 4-font list (Calibri/Arial/Times New Roman/Mangal) instead of
// the full approved set -- so the font gallery's "All Fonts" section
// silently showed only 4 fonts instead of every approved Word font,
// contradicting the "students get full access by default" default used
// everywhere else in this capability system.

test("a schema-v2 capabilities object with no fonts array falls back to the FULL approved font list, not a narrow 4-font list", () => {
  const caps = normalizeWordEditorCapabilities({ schemaVersion: "2", tabs: {} });
  assert.deepEqual([...caps.fonts].sort(), [...APPROVED_WORD_FONTS].sort());
  assert.ok(caps.fonts.length > 4, "expected the full approved font set, not just the old 4-font fallback");
});

test("a capabilities object with fonts explicitly set to an empty array also falls back to the full approved list", () => {
  const caps = normalizeWordEditorCapabilities({ schemaVersion: "2", tabs: {}, fonts: [] });
  assert.deepEqual([...caps.fonts].sort(), [...APPROVED_WORD_FONTS].sort());
});

test("a legacy (pre-schemaVersion-2) capabilities object with no fonts array also falls back to the full approved list", () => {
  const caps = normalizeWordEditorCapabilities({ tabs: ["Home"], commands: ["bold"] });
  assert.deepEqual([...caps.fonts].sort(), [...APPROVED_WORD_FONTS].sort());
});

test("an explicitly configured, narrower font list is still honored exactly as authored -- this fix only changes the fallback, not a real admin choice", () => {
  const caps = normalizeWordEditorCapabilities({ schemaVersion: "2", tabs: {}, fonts: ["Calibri", "Arial"] });
  assert.deepEqual(caps.fonts, ["Calibri", "Arial"]);
});
