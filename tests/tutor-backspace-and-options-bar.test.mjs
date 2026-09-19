import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

// Real requested feature, both Hindi (Kruti Dev) and English learn-keys
// tutors: a Backspace on/off toggle, its own distinct pill-shaped button
// (not a plain toggle switch), and -- following a later request to mirror
// every change made to one tutor onto the other -- Settings opens in the
// same floating, viewport-aware, focus-trapped popup the real
// typing-test workspace uses (TypingSettingsPopup,
// configurable-typing-exam.tsx), via a gear-icon trigger, not an inline
// listing. Both tutors are kept structurally identical by these shared
// assertions; only user-facing label text differs.

for (const [file, autoScrollLabel] of [
  ["app/typing/learn/krutidev/krutidev-tutor.tsx", "ऑटो स्क्रॉल"],
  ["app/typing/learn/english-tutor/english-tutor.tsx", "Auto scroll"],
]) {
  test(`${file} has a Backspace on/off toggle but no live press counter or Progress strip (removed entirely, on request)`, async () => {
    const content = await read(file);
    assert.match(content, /const \[backspaceEnabled, setBackspaceEnabled\] = useState\(true\);/);
    assert.match(content, /<BackspaceOption enabled=\{backspaceEnabled\} onChange=\{setBackspaceEnabled\} onLabel="[^"]+" offLabel="[^"]+" ?\/>/);
    assert.doesNotMatch(content, /backspaceCount/);
    assert.doesNotMatch(content, /const live = useMemo/);
    assert.doesNotMatch(content, />(Progress|प्रगति)<\/span>/);
  });

  // Real requested polish: Backspace used to be an ordinary label + switch,
  // no different from Bold/Sound -- now gets its own pill-shaped button
  // with a backspace glyph (⌫), styled like the header's own arrow-link
  // ("← सभी हिन्दी पाठ" / "← All English Lessons"), so its state is
  // legible at a glance instead of blending into the row of plain toggles.
  test(`${file} styles Backspace as a distinct pill button with a backspace glyph, not a plain toggle switch`, async () => {
    const content = await read(file);
    assert.match(content, /function BackspaceOption\(/);
    assert.match(content, /⌫/);
    assert.match(content, /aria-pressed=\{enabled\}/);
  });

  // Real reported follow-up request: an inline expanding listing (this
  // test used to check for) still pushed the drill down -- wrong
  // pattern. Now reuses the exact same floating popup the real
  // typing-test workspace opens its own Settings from, triggered by a
  // gear-icon button instead of a text "Settings ▾" one.
  test(`${file} opens Settings in the same floating popup the real typing-test workspace uses, via a gear-icon trigger, not an inline listing`, async () => {
    const content = await read(file);
    assert.match(content, /const \[settingsOpen, setSettingsOpen\] = useState\(false\);/);
    assert.match(content, /import \{ TypingSettingsPopup \} from "\.\.\/\.\.\/_components\/configurable-typing-exam";/);
    assert.match(content, /<TypingSettingsPopup triggerRef=\{settingsTriggerRef\} onClose=\{closeSettings\}>/);
    assert.match(content, /aria-haspopup="dialog"/);
    assert.match(content, /<circle cx="12" cy="12" r="3" \/>/); // the gear icon, not a "▾" text glyph
    assert.match(content, new RegExp(`<Toggle checked=\\{autoScroll\\} onChange=\\{setAutoScroll\\} label="${autoScrollLabel}" />`));
  });

  // Real reported request: the drill box can scroll the current position
  // out of view on long paragraphs/word sets -- the current-character
  // span now carries a ref that's scrolled into view whenever the caret
  // advances, toggleable from the Settings popup.
  test(`${file} auto-scrolls the current position into view (toggleable), by ref on the "cur" span`, async () => {
    const content = await read(file);
    assert.match(content, /const \[autoScroll, setAutoScroll\] = useState\(true\);/);
    assert.match(content, /caretElRef\.current\?\.scrollIntoView\(\{ behavior: "smooth", block: "nearest", inline: "nearest" \}\);/);
    assert.match(content, /ref=\{state === "cur" \? caretElRef : undefined\}/);
  });
}
