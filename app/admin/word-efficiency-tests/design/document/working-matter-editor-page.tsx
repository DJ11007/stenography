"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RichDocumentEditor } from "@/app/typing/word-efficiency/[language]/[testId]/workspace/rich-document-editor";
import { ConfirmDialog } from "@/components/efficiency/exam-chrome";
import type { WorkingMatterSnapshot } from "@/lib/word-docx";
import { blankWorkingMatter, editorDocumentToMatter } from "@/lib/word-matter-from-editor";
import { designerCapabilities } from "@/lib/word-designer-capabilities";
import { clearMatterDraft, readMatterDraft, writeMatterDraft } from "@/lib/word-matter-draft";

// Word's default paragraph spacing: 8 pt after each paragraph, 1.15 line spacing.
const PARAGRAPH_DEFAULTS = { spaceAfter: 8, lineHeight: 1.15 };
const PARAGRAPH_DEFAULTS_FOR_MATTER = { defaultSpaceAfter: 8, defaultLineSpacing: 1.15 };

// Full-screen page where the admin types and formats the document students will work on, in the
// same editor students use. "Save & return" parks the finished document for the test form, which
// picks it up and saves it with the test (see working-matter-designer.tsx).
export function WorkingMatterEditorPage({ target, language, title, initialSnapshot, backHref }: {
  target: string; language: "English" | "Hindi"; title: string; initialSnapshot: WorkingMatterSnapshot | null; backHref: string;
}) {
  const router = useRouter();
  const capabilities = useMemo(() => designerCapabilities(), []);
  const snapshotRef = useRef<(() => unknown) | null>(null);
  const [base, setBase] = useState<WorkingMatterSnapshot | null | undefined>(undefined); // undefined = still loading
  const [problem, setProblem] = useState<string | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [restored, setRestored] = useState<"work" | "staged" | null>(null);

  // Start from unsaved work, else the document already chosen for this test, else the saved one.
  useEffect(() => {
    const work = readMatterDraft(target, "wip");
    const staged = work ? null : readMatterDraft(target, "staged");
    setRestored(work ? "work" : staged ? "staged" : null);
    setBase(work ?? staged ?? initialSnapshot ?? null);
  }, [target, initialSnapshot]);

  const original = useMemo(() => base ?? blankWorkingMatter(language), [base, language]);

  // Autosave into the work-in-progress slot only (never blocks, never errors on an empty page).
  const keepWork = async (document: unknown) => {
    const result = editorDocumentToMatter(document, language, PARAGRAPH_DEFAULTS_FOR_MATTER);
    if (result.ok) writeMatterDraft(target, "wip", result.matter);
    return { ok: true, error: "" };
  };
  const saveAndReturn = async (document: unknown) => {
    const latest = snapshotRef.current?.() ?? document;
    const result = editorDocumentToMatter(latest, language, PARAGRAPH_DEFAULTS_FOR_MATTER);
    if (!result.ok) { setProblem(result.error); return { ok: false, error: result.error }; }
    writeMatterDraft(target, "staged", result.matter);
    clearMatterDraft(target, "wip");
    router.push(backHref);
    return { ok: true, error: "" };
  };

  return (
    <main className="matter-designer flex h-dvh flex-col bg-slate-200">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 bg-slate-950 px-4 py-2.5 text-white">
        <div className="flex min-w-0 items-center gap-3">
          <button type="button" onClick={() => setDiscardOpen(true)} className="rounded-lg bg-white/10 px-3 py-2 text-sm font-black hover:bg-white/20">← Back</button>
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-wider text-cyan-300">Working Document · {language}</p>
            <h1 className="truncate font-black">{title}</h1>
          </div>
        </div>
        <p className="hidden max-w-xl text-xs text-slate-300 xl:block">Type or paste the document students will work on and format it as it should look. Tip: <span className="font-mono text-white">=rand()</span> then Enter adds 5 paragraphs of 4 lines; <span className="font-mono text-white">=rand(6,3)</span> adds 6 paragraphs of 3 lines.</p>
        <div className="flex items-center gap-3">
          {restored && <span className="rounded-lg bg-amber-500/20 px-2 py-1 text-xs font-bold text-amber-200">{restored === "work" ? "Restored your unsaved work" : "Showing the document you chose earlier"}</span>}
          <span id="matter-save-slot" className="flex items-center gap-2" />
        </div>
      </header>
      <div className="min-h-0 flex-1">
        {base === undefined ? <p className="p-6 text-sm font-bold text-slate-600">Loading the document…</p> : (
          <RichDocumentEditor
            attemptId={`working-matter-${target}`}
            original={original}
            capabilities={capabilities}
            locked={false}
            mode="authoring"
            oneTimeSubmit={false}
            submitConfirmMessage={null}
            submitLabel="Save & return"
            submitPortalId="matter-save-slot"
            fullHeight
            paragraphDefaults={PARAGRAPH_DEFAULTS}
            snapshotRef={snapshotRef}
            randomText={{ language: () => language }}
            documentLanguage={language === "Hindi" ? "Hindi" : "English (U.S.)"}
            autosaveAction={async (_id, document) => keepWork(document)}
            submitAction={async (_id, document) => saveAndReturn(document)}
          />
        )}
      </div>
      <ConfirmDialog open={problem !== null} title="Cannot save yet" message={problem} confirmLabel="OK" cancelLabel={null} tone="primary" onCancel={() => setProblem(null)} onConfirm={() => setProblem(null)} />
      <ConfirmDialog open={discardOpen} title="Leave without saving?" message="Changes you have not saved with Save & return are kept as unsaved work on this computer and offered again next time. The test keeps its current document." confirmLabel="Leave" cancelLabel="Stay" tone="danger" onCancel={() => setDiscardOpen(false)} onConfirm={() => router.push(backHref)} />
    </main>
  );
}
