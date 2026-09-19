import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

// Real requested feature, both Hindi (Kruti Dev) and English learn-keys
// tutors: a Backspace on/off toggle, a live count of how many times
// Backspace was pressed, and moving every settings toggle from the narrow
// right-side aside up into the passage card itself -- directly below the
// font-size (A-/A+) controls and above the original passage display, which
// are the same spot described two ways.

for (const [file, label] of [
  ["app/typing/learn/krutidev/krutidev-tutor.tsx", "बैकस्पेस"],
  ["app/typing/learn/english-tutor/english-tutor.tsx", "Backspace"],
]) {
  const isEnglish = file.includes("english-tutor");
  test(`${file} has a Backspace on/off toggle and a live press counter`, async () => {
    const content = await read(file);
    assert.match(content, /const \[backspaceEnabled, setBackspaceEnabled\] = useState\(true\);/);
    assert.match(content, /const \[backspaceCount, setBackspaceCount\] = useState\(0\);/);
    // reset alongside the other per-exercise state
    assert.match(content, /setBackspaceCount\(0\);/);
    assert.match(content, /<BackspaceOption enabled=\{backspaceEnabled\} onChange=\{setBackspaceEnabled\} onLabel="[^"]+" offLabel="[^"]+" ?\/>/);
    // every Backspace press is counted, whether or not it's allowed through
    assert.match(content, /if \(event\.key !== "Backspace"\) return;\s*setBackspaceCount\(\(value\) => value \+ 1\);\s*if \(!backspaceEnabled\) event\.preventDefault\(\);/);
    assert.match(content, new RegExp(`<span>${label} <b className="text-sm text-slate-900">\\{backspaceCount\\}</b></span>`));
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

  if (isEnglish) {
    // Real reported follow-up request, English only: the flat always-visible
    // options row (this test used to check for) is now a collapsed
    // "Settings ▾" button that expands into a vertical listing with its own
    // close (✕) button -- and the live progress strip moved back down,
    // directly below the exercise-selector row instead of sitting above it,
    // "sent down" one level per the request. Kruti Dev is untouched -- its
    // own copies of these two tests (below) still check the older layout.
    test(`${file} collapses its settings into a listing (▾ to open, ✕ to close) that also holds font size and Auto scroll, directly below the exercise-selector row`, async () => {
      const content = await read(file);
      assert.match(content, /const \[settingsOpen, setSettingsOpen\] = useState\(false\);/);
      assert.match(content, /Settings <span aria-hidden className=\{`transition-transform \$\{settingsOpen \? "rotate-180" : ""\}`\}>▾<\/span>/);
      assert.match(content, /aria-label="Close settings"/);
      assert.match(content, /<Toggle checked=\{autoScroll\} onChange=\{setAutoScroll\} label="Auto scroll" \/>/);
      const exerciseSelectorRow = content.indexOf("Choose an exercise");
      const progressStrip = content.indexOf("Progress</span>");
      const settingsListing = content.indexOf("space-y-2.5 text-sm font-bold text-slate-700");
      assert.ok(exerciseSelectorRow > 0 && progressStrip > exerciseSelectorRow, "progress strip must come after (below) the exercise-selector row");
      assert.ok(settingsListing > progressStrip, "the settings listing must come after the progress strip");
    });

    // Real reported request: the drill box can scroll the current position
    // out of view on long paragraphs/word sets -- the current-character
    // span now carries a ref that's scrolled into view whenever the caret
    // advances, toggleable from the new Settings listing.
    test(`${file} auto-scrolls the current position into view (toggleable), by ref on the "cur" span`, async () => {
      const content = await read(file);
      assert.match(content, /const \[autoScroll, setAutoScroll\] = useState\(true\);/);
      assert.match(content, /caretElRef\.current\?\.scrollIntoView\(\{ behavior: "smooth", block: "nearest", inline: "nearest" \}\);/);
      assert.match(content, /ref=\{state === "cur" \? caretElRef : undefined\}/);
    });
  } else {
    test(`${file} moved its settings toggles out of the right-side aside, to directly below the font-size controls and above the passage display`, async () => {
      const content = await read(file);
      const fontSizeRow = content.indexOf("A+</button>");
      const optionsBar = content.indexOf("gap-x-4 gap-y-2 rounded-xl bg-slate-50");
      const passageDisplay = content.indexOf("whitespace-pre-wrap break-words rounded-xl bg-");
      assert.ok(fontSizeRow > 0 && optionsBar > fontSizeRow, "options bar must come after the font-size controls");
      assert.ok(passageDisplay > optionsBar, "options bar must come before the original passage display");
    });

    // Real reported feedback, follow-up: the live progress/stats strip used
    // to sit in a narrow right-side aside (below or beside the passage, since
    // it only stacked under it on mobile) -- moved to the very top of the
    // exercise view instead, above the exercise-selector/font-size row, and
    // the now-empty aside/two-column grid removed entirely in favour of a
    // single vertical stack.
    test(`${file} moved the live progress strip to the top of the exercise view, and removed the now-empty right-side aside/grid split`, async () => {
      const content = await read(file);
      assert.doesNotMatch(content, /<aside/);
      assert.doesNotMatch(content, /lg:grid-cols-\[minmax\(0,1fr\)_300px\]/);
      const progressStrip = content.indexOf("py-2.5 shadow-sm");
      const fontSizeRow = content.indexOf("A+</button>");
      assert.ok(progressStrip >= 0 && progressStrip < fontSizeRow, "progress strip must come before the exercise-selector/font-size row");
    });
  }
}
