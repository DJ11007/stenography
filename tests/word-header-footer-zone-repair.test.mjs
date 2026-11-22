import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { Window } from "happy-dom";
import { headerFooterPositions, repairHeaderFooterZones } from "../lib/word-header-footer-tabs.ts";

const zone = (align, inner) => `<span style="display: inline-block; width: 33%;${align ? ` text-align: ${align};` : ""}">${inner}</span>`;
const marker = '<span data-hf-tab="" contenteditable="false" style="display: inline-block; width: 0px; height: 1em; vertical-align: baseline;"></span>';

function header(html) {
  const window = new Window();
  window.document.body.innerHTML = `<div><header data-block-type="header">${html}</header></div>`;
  return window.document.querySelector("header");
}

// Hindi Word Test 5 Q8 (22 Nov 2026), the header exactly as the editor left it after Kruti Dev 010 was chosen for
// the centre text: the font command wrapped the centre position in a font span and left an empty centre behind.
// Four 33% positions do not fit, so the text showed in the right third and the right position took a new line.
test("a centre position wrapped by the font command goes back to three positions, the font on its text", () => {
  const area = header(zone("", "<br>") + zone("center", marker) + `<span style="font-family: &quot;Kruti Dev 010&quot;;">${zone("center", "vf/kuLFk cksMZ &amp; 2026")}</span>` + zone("right", marker + "<br>"));
  assert.equal(repairHeaderFooterZones(area), true);
  const zones = headerFooterPositions(area);
  assert.ok(zones, "exactly three positions");
  assert.deepEqual(zones.map((z) => z.style.textAlign || "left"), ["left", "center", "right"]);
  assert.equal(zones[1].textContent, "vf/kuLFk cksMZ & 2026");
  const text = zones[1].querySelector("span:not([data-hf-tab])");
  assert.match(text.getAttribute("style"), /Kruti Dev 010/);
  assert.ok(zones[1].firstChild.hasAttribute("data-hf-tab"), "the centre still starts with its tab stop");
  assert.equal(area.children.length, 3);
});

test("a correct three-position line is left alone", () => {
  const area = header(zone("", "A") + zone("center", marker + "B") + zone("right", marker + "C"));
  const before = area.innerHTML;
  assert.equal(repairHeaderFooterZones(area), false);
  assert.equal(area.innerHTML, before);
});

test("the editor repairs header/footer lines after every formatting command and after the Font dialog", async () => {
  const editor = await readFile(new URL("../app/typing/word-efficiency/[language]/[testId]/workspace/rich-document-editor.tsx", import.meta.url), "utf8");
  assert.match(editor, /document\.execCommand\(name,false,safeValue\);formatSelectedFields\(name,safeValue\);repairHeaderFooterLines\(\);/);
  assert.match(editor, /savedRange\.current=wrapped\.range;repairHeaderFooterLines\(\);changed\(\);/);
});
