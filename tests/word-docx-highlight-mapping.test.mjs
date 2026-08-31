import test from "node:test";
import assert from "node:assert/strict";
import { zipSync, strToU8 } from "fflate";
import { parseWorkingMatterDocx } from "../lib/word-docx.ts";

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`;
const RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;

function docxWithHighlights(highlightNames) {
  const runs = highlightNames.map((name, index) => `<w:r>${name ? `<w:rPr><w:highlight w:val="${name}"/></w:rPr>` : ""}<w:t>run${index}</w:t></w:r>`).join("");
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p>${runs}</w:p></w:body></w:document>`;
  return zipSync({
    "[Content_Types].xml": strToU8(CONTENT_TYPES),
    "_rels/.rels": strToU8(RELS),
    "word/document.xml": strToU8(documentXml),
  });
}

test("w:highlight's raw OOXML enum names are mapped to real hex, not passed through as a raw CSS-color-name string", () => {
  const bytes = docxWithHighlights(["black", "red", "yellow", "darkBlue"]);
  const snapshot = parseWorkingMatterDocx(bytes);
  const runs = snapshot.paragraphs[0].runs;
  assert.equal(runs[0].highlight, "000000");
  assert.equal(runs[1].highlight, "FF0000");
  assert.equal(runs[2].highlight, "FFFF00");
  assert.equal(runs[3].highlight, "00008B");
});

test("the OOXML enum name match is case-insensitive (Word's XML uses camelCase like darkGreen)", () => {
  const bytes = docxWithHighlights(["DARKGREEN", "DarkGreen"]);
  const snapshot = parseWorkingMatterDocx(bytes);
  const runs = snapshot.paragraphs[0].runs;
  assert.equal(runs[0].highlight, "006400");
  assert.equal(runs[1].highlight, "006400");
});

test("a run with no w:highlight element at all gets a null highlight, not an empty string", () => {
  const bytes = docxWithHighlights([null]);
  const snapshot = parseWorkingMatterDocx(bytes);
  assert.equal(snapshot.paragraphs[0].runs[0].highlight, null);
});
