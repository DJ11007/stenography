import { Fragment } from "react";
import { parseQuestionContent } from "@/lib/question-content";

// **bold**, *italic*, __underline__, ++bigger++ and ==highlight== (the admin editor's toolbar); they
// can be nested (**__bold underline__**). Rendered as React elements, never as HTML.
const INLINE = /(\*\*[^*\n]+?\*\*|__[^_\n]+?__|==[^=\n]+?==|\+\+[^+\n]+?\+\+|\*[^*\s][^*\n]*?\*)/u;
function Inline({ text }: { text: string }) {
  const parts = text.split(new RegExp(INLINE.source, "gu"));
  return <>{parts.map((part, index) => {
    if (part.length > 4 && part.startsWith("**") && part.endsWith("**")) return <strong key={index}><Inline text={part.slice(2, -2)} /></strong>;
    if (part.length > 4 && part.startsWith("__") && part.endsWith("__")) return <u key={index}><Inline text={part.slice(2, -2)} /></u>;
    if (part.length > 4 && part.startsWith("==") && part.endsWith("==")) return <mark key={index} style={{ background: "#ffff00", color: "inherit" }}><Inline text={part.slice(2, -2)} /></mark>;
    if (part.length > 4 && part.startsWith("++") && part.endsWith("++")) return <span key={index} style={{ fontSize: "1.25em" }}><Inline text={part.slice(2, -2)} /></span>;
    if (part.length > 2 && part.startsWith("*") && part.endsWith("*")) return <em key={index}><Inline text={part.slice(1, -1)} /></em>;
    return <Fragment key={index}>{part}</Fragment>;
  })}</>;
}

/** Renders an admin-authored question's plain-text `instruction` field,
 * recognizing bold text, bullet/numbered lists, and pipe tables -- so a
 * question that embeds a small table or list (the way a real Word/Excel
 * question paper does) renders as one, everywhere a student or grading
 * admin sees it. Falls back to a plain paragraph for ordinary text. */
export function QuestionContent({ text, className }: { text: string | null | undefined; className?: string }) {
  if (!text?.trim()) return null;
  const blocks = parseQuestionContent(text);
  return (
    <div className={`space-y-3 text-sm leading-6 ${className ?? ""}`}>
      {blocks.map((block, index) => {
        if (block.type === "table") return (
          <div key={index} className="overflow-x-auto">
            <table className="min-w-full border-collapse border border-slate-300 text-xs">
              <tbody>
                {block.rows.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {row.map((cell, cellIndex) => (rowIndex === 0
                      ? <th key={cellIndex} className="border border-slate-300 bg-slate-100 p-2 text-left font-black"><Inline text={cell} /></th>
                      : <td key={cellIndex} className="border border-slate-300 p-2"><Inline text={cell} /></td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        if (block.type === "bullet-list") return <ul key={index} className="list-disc space-y-1 pl-5">{block.items.map((item, itemIndex) => <li key={itemIndex}><Inline text={item} /></li>)}</ul>;
        if (block.type === "numbered-list") return <ol key={index} className="list-decimal space-y-1 pl-5">{block.items.map((item, itemIndex) => <li key={itemIndex}><Inline text={item} /></li>)}</ol>;
        return <p key={index} className="whitespace-pre-wrap"><Inline text={block.text} /></p>;
      })}
    </div>
  );
}
