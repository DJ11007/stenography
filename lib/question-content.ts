// Question instructions are still stored as plain text (no schema change --
// the existing `instruction text` columns on word_efficiency_questions and
// excel_efficiency_questions already bound length appropriately). This adds
// a small, safe markdown-like syntax on top of that plain text so an admin
// can compose a question containing a table or a list -- exactly what a
// real MS Word/Excel question paper needs -- without ever persisting raw
// HTML. Supported per block: **bold** inline text, "- "/"* " bullet lists,
// "1. "/"1) " numbered lists, and GFM-style pipe tables with a separator row.
// Anything that doesn't match one of those shapes renders as a plain
// paragraph, so ordinary question text is completely unaffected.

export type QuestionContentBlock =
  | { type: "paragraph"; text: string }
  | { type: "bullet-list"; items: string[] }
  | { type: "numbered-list"; items: string[] }
  | { type: "table"; rows: string[][] };

function splitRow(line: string): string[] {
  let trimmed = line.trim();
  if (trimmed.startsWith("|")) trimmed = trimmed.slice(1);
  if (trimmed.endsWith("|")) trimmed = trimmed.slice(0, -1);
  return trimmed.split("|").map((cell) => cell.trim());
}

function isSeparatorRow(line: string): boolean {
  const cells = splitRow(line);
  return cells.length > 0 && cells.every((cell) => /^:?-{1,}:?$/.test(cell));
}

export function parseQuestionContent(raw: string): QuestionContentBlock[] {
  const blocks = raw
    .replace(/\r\n?/g, "\n")
    .split(/\n{2,}/u)
    .map((block) => block.trim())
    .filter(Boolean);

  return blocks.map((block): QuestionContentBlock => {
    const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
    if (lines.length >= 2 && lines[0].includes("|") && isSeparatorRow(lines[1])) {
      const rows = [splitRow(lines[0]), ...lines.slice(2).map(splitRow)];
      return { type: "table", rows };
    }
    if (lines.length && lines.every((line) => /^[-*]\s+/.test(line))) {
      return { type: "bullet-list", items: lines.map((line) => line.replace(/^[-*]\s+/, "")) };
    }
    if (lines.length && lines.every((line) => /^\d+[.)]\s+/.test(line))) {
      return { type: "numbered-list", items: lines.map((line) => line.replace(/^\d+[.)]\s+/, "")) };
    }
    return { type: "paragraph", text: block };
  });
}

/** Converts tab-and-newline-delimited text (what a real spreadsheet or Word
 * table puts on the clipboard) into the pipe-table markdown parseQuestionContent
 * understands. Returns null when the text does not look tabular, so the
 * caller can fall back to a plain-text paste. */
export function tabularTextToMarkdownTable(text: string): string | null {
  const lines = text.replace(/\r\n?/g, "\n").split("\n").filter((line) => line.length > 0);
  if (lines.length < 1) return null;
  const tabbedLines = lines.filter((line) => line.includes("\t"));
  if (tabbedLines.length < Math.max(1, lines.length - 1)) return null;
  const rows = lines.map((line) => line.split("\t").map((cell) => cell.trim().replace(/\|/g, "/")));
  if (rows.some((row) => row.length < 2)) return null;
  const width = Math.max(...rows.map((row) => row.length));
  const padded = rows.map((row) => [...row, ...Array(width - row.length).fill("")]);
  const header = `| ${padded[0].join(" | ")} |`;
  const separator = `|${padded[0].map(() => "---").join("|")}|`;
  const body = padded.slice(1).map((row) => `| ${row.join(" | ")} |`);
  return [header, separator, ...body].join("\n");
}
