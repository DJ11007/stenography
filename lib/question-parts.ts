// Splits an exam instruction like "Give above formatting's to the main documents.
// a) Set page size to A5. b) Set the right margin ... c) ..." into its opening line
// and its lettered parts, so each part can be shown on its own line. Returns null
// when the text has no a), b) ... sequence (it is then shown as written).
export type QuestionParts = { intro: string; parts: { label: string; text: string }[] };

export function splitQuestionParts(text: string | null | undefined): QuestionParts | null {
  // A space typed before a full stop or comma ("red color .") is dropped so the mark stays on its line.
  const source = (text ?? "").replace(/\s+/g, " ").replace(/ ([.,;:])(?=\s|$)/g, "$1").trim();
  if (!source) return null;
  const marker = /(^|[\s.;:,])\(?([a-z])\)\s*/gi;
  const cuts: { label: string; start: number; end: number }[] = [];
  let expected = "a";
  for (let match = marker.exec(source); match; match = marker.exec(source)) {
    const letter = match[2].toLowerCase();
    if (letter !== expected) continue;
    cuts.push({ label: letter, start: match.index + match[1].length, end: match.index + match[0].length });
    expected = String.fromCharCode(expected.charCodeAt(0) + 1);
  }
  if (cuts.length < 2) return null;
  const parts = cuts.map((cut, index) => ({ label: cut.label, text: source.slice(cut.end, cuts[index + 1]?.start ?? source.length).trim() }));
  if (parts.some(part => !part.text)) return null;
  return { intro: source.slice(0, cuts[0].start).trim(), parts };
}
