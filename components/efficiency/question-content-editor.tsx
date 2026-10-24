"use client";
import { useRef, useState } from "react";
import { krutiDevToUnicode } from "@/lib/hindi-font-converter";
import { tabularTextToMarkdownTable } from "@/lib/question-content";

export type QuestionTypingLanguage = "English" | "Hindi";

const DEVANAGARI = /[ऀ-ॿ]/u;
// Formatting marks the toolbar puts around a word; they stay as they are when the word is converted.
const LEADING_MARKS = /^(?:\*\*|__|==|\+\+|\*)+/u;
const TRAILING_MARKS = /(?:\*\*|__|==|\+\+|\*)+$/u;

/** One word typed with Kruti Dev keys ("ukyank") as Hindi ("नालंदा"); a word already in Hindi, or
 * one with no letters, is left alone. */
function hindiWord(token: string) {
  const lead = token.match(LEADING_MARKS)?.[0] ?? "";
  const rest = token.slice(lead.length);
  const trail = rest.match(TRAILING_MARKS)?.[0] ?? "";
  const core = rest.slice(0, rest.length - trail.length);
  if (!core || DEVANAGARI.test(core) || !/[A-Za-z]/u.test(core)) return token;
  return lead + krutiDevToUnicode(core) + trail;
}

/** The instruction textarea used by both the Word and Excel admin question
 * editors. A small toolbar inserts the bold / italic / underline / bigger / highlight / list / table
 * markdown that components/efficiency/question-content.tsx renders, and pasting a table copied
 * straight out of Word or Excel is auto-converted into that table markdown instead of landing as a
 * wall of tab characters. With typing set to हिन्दी, each word typed with Kruti Dev keys becomes
 * Hindi as soon as it is finished (space or Enter), and "Kruti Dev → हिन्दी" converts selected
 * text pasted in Kruti Dev. */
export function QuestionContentEditor({ value, onChange, required, ariaLabel, typing, onTypingChange }: { value: string; onChange: (value: string) => void; required?: boolean; ariaLabel?: string; typing?: QuestionTypingLanguage; onTypingChange?: (typing: QuestionTypingLanguage) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [ownTyping, setOwnTyping] = useState<QuestionTypingLanguage>("English");
  const language = typing ?? ownTyping;
  const setLanguage = onTypingChange ?? setOwnTyping;

  const replaceSelection = (build: (selected: string) => { text: string; cursorOffset: number }) => {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart, end = el.selectionEnd;
    const { text, cursorOffset } = build(value.slice(start, end));
    const next = value.slice(0, start) + text + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => { el.focus(); const cursor = start + cursorOffset; el.setSelectionRange(cursor, cursor); });
  };

  const insertBlock = (block: string) => {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart, end = el.selectionEnd;
    const needsLeadingBreak = start > 0 && value[start - 1] !== "\n";
    const prefix = needsLeadingBreak ? "\n\n" : "";
    const next = value.slice(0, start) + prefix + block + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => { el.focus(); const cursor = start + prefix.length + block.length; el.setSelectionRange(cursor, cursor); });
  };

  const wrap = (mark: string, placeholder: string) => replaceSelection((selected) => { const text = selected || placeholder; return { text: `${mark}${text}${mark}`, cursorOffset: text.length + mark.length * 2 }; });
  const applyBullets = () => replaceSelection((selected) => { const source = selected || "First item\nSecond item"; const text = source.split("\n").map((line) => (line.trim() ? `- ${line.replace(/^[-*]\s+/, "")}` : line)).join("\n"); return { text, cursorOffset: text.length }; });
  const applyNumbers = () => replaceSelection((selected) => { const source = selected || "First item\nSecond item"; const text = source.split("\n").map((line, index) => (line.trim() ? `${index + 1}. ${line.replace(/^\d+[.)]\s+/, "")}` : line)).join("\n"); return { text, cursorOffset: text.length }; });
  const insertTable = () => insertBlock("| Column 1 | Column 2 | Column 3 |\n|---|---|---|\n|  |  |  |\n|  |  |  |");
  const convertSelection = () => replaceSelection((selected) => { const text = selected.split(/(\s+)/u).map((part) => (/^\s+$/u.test(part) ? part : hindiWord(part))).join(""); return { text, cursorOffset: text.length }; });

  // हिन्दी typing: the word just finished (the character typed is a space or a line break) is
  // converted; the caret stays after it.
  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const el = event.target, next = el.value, caret = el.selectionStart;
    if (language !== "Hindi" || caret !== el.selectionEnd || next.length <= value.length || !/\s/u.test(next[caret - 1] ?? "")) { onChange(next); return; }
    const end = caret - 1, start = Math.max(next.lastIndexOf(" ", end - 1), next.lastIndexOf("\n", end - 1), next.lastIndexOf("\t", end - 1)) + 1;
    const token = next.slice(start, end), converted = hindiWord(token);
    if (converted === token) { onChange(next); return; }
    onChange(next.slice(0, start) + converted + next.slice(end));
    const cursor = caret + converted.length - token.length;
    requestAnimationFrame(() => el.setSelectionRange(cursor, cursor));
  };
  // The last word, when the box is left without a space after it.
  const handleBlur = () => {
    if (language !== "Hindi") return;
    const match = value.match(/(\S+)$/u);
    if (!match) return;
    const converted = hindiWord(match[1]);
    if (converted !== match[1]) onChange(value.slice(0, value.length - match[1].length) + converted);
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const text = event.clipboardData.getData("text/plain");
    if (!text) return;
    const table = tabularTextToMarkdownTable(text);
    if (!table) return;
    event.preventDefault();
    insertBlock(table);
  };

  return (
    <div className="grid gap-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="inline-flex overflow-hidden rounded-lg border border-slate-300" role="group" aria-label="Typing language">
          {(["English", "Hindi"] as const).map((item) => <button key={item} type="button" aria-pressed={language === item} onMouseDown={(event) => event.preventDefault()} onClick={() => setLanguage(item)} className={`px-2.5 py-1 text-xs font-bold ${language === item ? "bg-slate-800 text-white" : "bg-white text-slate-700 hover:bg-slate-50"}`}>{item === "Hindi" ? "हिन्दी" : "English"}</button>)}
        </span>
        <ToolbarButton label="B" title="Bold" className="font-black" onClick={() => wrap("**", "bold text")} />
        <ToolbarButton label="I" title="Italic" className="italic" onClick={() => wrap("*", "italic text")} />
        <ToolbarButton label="U" title="Underline" className="underline" onClick={() => wrap("__", "underlined text")} />
        <ToolbarButton label="A+" title="Bigger text" onClick={() => wrap("++", "bigger text")} />
        <ToolbarButton label="Highlight" title="Yellow highlight" style={{ background: "#ffff00" }} onClick={() => wrap("==", "highlighted text")} />
        <ToolbarButton label="• Bullet list" onClick={applyBullets} />
        <ToolbarButton label="1. Numbered list" onClick={applyNumbers} />
        <ToolbarButton label="⊞ Insert table" onClick={insertTable} />
        {language === "Hindi" && <ToolbarButton label="Kruti Dev → हिन्दी" title="Convert the selected Kruti Dev text to Hindi" onClick={convertSelection} />}
      </div>
      <textarea ref={ref} aria-label={ariaLabel} lang={language === "Hindi" ? "hi" : "en"} className="input min-h-28 font-mono text-sm" required={required} value={value} onChange={handleChange} onBlur={handleBlur} onPaste={handlePaste} />
      <p className="text-[11px] text-slate-500">{language === "Hindi" ? "हिन्दी: type with Kruti Dev keys — each word turns into Hindi when you press Space or Enter (ukyank → नालंदा). Text typed in Hindi directly stays as it is. Select pasted Kruti Dev text and click Kruti Dev → हिन्दी to convert it." : "Tip: paste a table copied straight from Word or Excel here — it converts automatically into a rendered table for students. Select text and use the buttons above for bold, italic, underline, bigger or highlighted text, or a list/table."}</p>
    </div>
  );
}

function ToolbarButton({ label, onClick, title, className, style }: { label: string; onClick: () => void; title?: string; className?: string; style?: React.CSSProperties }) {
  return <button type="button" style={style} title={title} aria-label={title} onMouseDown={(event) => event.preventDefault()} onClick={onClick} className={`rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-50 ${className ?? ""}`}>{label}</button>;
}
