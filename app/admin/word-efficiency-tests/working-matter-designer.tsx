"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { WorkingMatterSnapshot } from "@/lib/word-docx";
import { describeMatter, readMatterDraft } from "@/lib/word-matter-draft";

// The test form's "Working Document" card. The document itself is typed on its own full-screen page
// (design/document); when the admin presses "Save & return" there, it is parked in this browser and
// picked up here, and it is saved together with the rest of the test when the form is saved.
export function WorkingMatterDesigner({ initialSnapshot, editId }: { initialSnapshot: WorkingMatterSnapshot | null; editId: string | null }) {
  const router = useRouter();
  const target = editId || "new";
  const root = useRef<HTMLFieldSetElement>(null);
  const hidden = useRef<HTMLInputElement>(null);
  const [matter, setMatter] = useState<WorkingMatterSnapshot | null>(initialSnapshot);
  const [changed, setChanged] = useState(false);
  const [error, setError] = useState("");

  // Pick up a document that was just saved on the editor page. Done a moment after load so it wins
  // over a restored local draft of this form (which also contains the old document).
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const staged = readMatterDraft(target, "staged");
      if (staged) { setMatter(staged); setChanged(true); setError(""); }
    }, 400);
    return () => window.clearTimeout(timer);
  }, [target]);

  const formLanguage = (): "English" | "Hindi" => {
    const field = root.current?.closest("form")?.elements.namedItem("language") as HTMLSelectElement | RadioNodeList | null;
    return field && "value" in field && field.value === "Hindi" ? "Hindi" : "English";
  };

  // Saving the test needs a document, and it must be in the test's language.
  useEffect(() => {
    const form = root.current?.closest("form");
    if (!form) return;
    const beforeSubmit = (event: Event) => {
      if (!matter) {
        event.preventDefault(); event.stopImmediatePropagation();
        setError("Design the working document before saving the test: press “Open Document Editor”.");
        root.current?.scrollIntoView({ block: "center" });
        return;
      }
      const language = formLanguage();
      if (hidden.current && matter.language !== language) hidden.current.value = JSON.stringify({ ...matter, language });
    };
    form.addEventListener("submit", beforeSubmit, true);
    return () => form.removeEventListener("submit", beforeSubmit, true);
  }); // eslint-disable-line react-hooks/exhaustive-deps -- re-bound each render so it always sees the current document

  const summary = useMemo(() => (matter ? describeMatter(matter) : null), [matter]);
  const json = matter ? JSON.stringify(matter) : "";

  const openEditor = () => {
    // Keep what has been typed into the rest of the form while the editor page is open.
    window.dispatchEvent(new Event("word-efficiency:save-draft"));
    try { window.sessionStorage.setItem("samradhi-word-draft-auto-restore", "1"); } catch { /* private mode: the normal restore prompt will appear */ }
    window.setTimeout(() => router.push(`/admin/word-efficiency-tests/design/document?${editId ? `edit=${encodeURIComponent(editId)}&` : ""}language=${formLanguage()}`), 650);
  };

  return (
    <fieldset ref={root} className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4">
      <legend className="px-2 font-black">Working Document</legend>
      <p className="text-sm text-slate-600">The document students will work on is typed and formatted in its own full-screen editor, in the same Word-style editor students use. Nothing is uploaded or converted.</p>
      <input ref={hidden} type="hidden" name="workingMatterSnapshot" value={json} readOnly />
      {summary ? (
        <div className="mt-3 rounded-xl bg-white p-4">
          <p className="font-bold text-emerald-800">
            {changed ? "New document ready — saved with the test when you press Save: " : "Current document: "}
            {summary.paragraphs} paragraph{summary.paragraphs === 1 ? "" : "s"}{summary.tables ? `, ${summary.tables} table${summary.tables === 1 ? "" : "s"}` : ""}, {summary.words} words.
          </p>
          <ul className="mt-2 space-y-1 text-sm text-slate-600">{summary.preview.map((text, index) => <li key={index} className="truncate">{text}</li>)}</ul>
          {(matter?.warnings ?? []).map(warning => <p key={warning} className="mt-2 rounded-lg bg-amber-50 p-2 text-sm font-bold text-amber-900">{warning}</p>)}
        </div>
      ) : (
        <p className="mt-3 rounded-xl bg-amber-50 p-4 text-sm font-bold text-amber-900">No working document yet. Open the document editor to type it.</p>
      )}
      {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm font-bold text-red-800">{error}</p>}
      <button type="button" onClick={openEditor} className="mt-4 rounded-xl bg-emerald-700 px-5 py-3 font-black text-white shadow hover:bg-emerald-600">
        {matter ? "Edit Document in the Editor" : "Open Document Editor"}
      </button>
    </fieldset>
  );
}
