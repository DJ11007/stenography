"use client";
import { useState } from "react";
import { RichDocumentEditor } from "../../../[language]/[testId]/workspace/rich-document-editor";
import { BackButton } from "@/app/_components/back-button";
import { QuestionBar } from "@/components/efficiency/question-bar";
import type { WorkingMatterSnapshot } from "@/lib/word-docx";

type Question = { id: string; question_version_id: string; number: number; display_order: number; instruction: string | null; marks: number; section: string | null; is_visible: boolean };
export type AnswerReviewSnapshot = { title: string; language: string; questions?: Question[]; working_matter: WorkingMatterSnapshot; editor_capabilities: Record<string, unknown> };

// Read-only: `locked` is the editor's own submitted state (no typing, no formatting, no autosave), so
// the page shows the submitted document exactly as the student left it -- header, borders, shading,
// indents, bullets, page border, table formatting -- and the student can scroll and zoom through it.
export function AnswerReview({ attemptId, snapshot, document }: { attemptId: string; snapshot: AnswerReviewSnapshot; document: unknown }) {
  const [current, setCurrent] = useState(0);
  const questions = (snapshot.questions ?? []).filter(question => question.is_visible !== false);
  return (
    <main className="flex min-h-screen flex-col bg-slate-950">
      <header className="flex flex-wrap items-center gap-3 px-4 py-3 text-white">
        <BackButton href={`/typing/word-efficiency/results/${attemptId}`} label="Result" dark />
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[.2em] text-cyan-300">Your answer · read only</p>
          <h1 className="truncate text-lg font-black">{snapshot.title}</h1>
        </div>
        <p className="ml-auto text-sm text-slate-300">This is the document you submitted. Pick a question to compare it with your work.</p>
      </header>
      <div className="min-h-0 flex-1">
        <RichDocumentEditor
          attemptId={attemptId}
          original={snapshot.working_matter}
          capabilities={snapshot.editor_capabilities}
          initialDocument={document}
          locked
          documentLanguage={snapshot.language.toLowerCase() === "hindi" ? "Hindi" : "English (U.S.)"}
          questionBar={questions.length ? <QuestionBar questions={questions} current={current} onSelect={setCurrent} language={snapshot.language} /> : undefined}
        />
      </div>
    </main>
  );
}
