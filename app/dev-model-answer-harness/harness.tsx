"use client";
// TEMPORARY, local development only -- not committed. See page.tsx.
import { RichDocumentEditor, applySavedPageLayout } from "@/app/typing/word-efficiency/[language]/[testId]/workspace/rich-document-editor";
import { diffWordDocuments, modelAnswerRuleCriteria, stripBlankParagraphs } from "@/lib/word-document-diff";
import type { WorkingMatterSnapshot } from "@/lib/word-docx";
import { useEffect, useState } from "react";
import { QuestionBar } from "@/components/efficiency/question-bar";
import { generateWordEfficiencyGradingRulesFromModelAnswer, saveWordEfficiencyModelAnswer } from "@/app/admin/word-efficiency-tests/actions";
import { gradeAgainstLive } from "./grade-action";
import { writeHarnessFixture } from "./fixture-action";
import { writeSolutionImage } from "./image-action";
import { toCanvas } from "html-to-image";

// Paper-solution screenshots: draws the document page (or the element matched by a selector), crops it to the
// given paragraphs (indexes of the page children) and saves a JPEG through writeSolutionImage.
async function captureSolution(name: string, indexes: number[], options: { padTop?: number; padBottom?: number; selector?: string; full?: boolean; height?: number; maxHeight?: number } = {}) {
  const page = document.querySelector(options.selector ?? ".word-page-frame") as HTMLElement;
  const scale = 1.3, full = await toCanvas(page, { pixelRatio: scale, backgroundColor: "#ffffff", cacheBust: true });
  const box = page.getBoundingClientRect(), kids = [...document.querySelector("[contenteditable=true]")!.children] as HTMLElement[];
  let top = 0, bottom = Math.min(page.offsetHeight, options.height ?? Infinity);
  if (!options.full && indexes.length) {
    top = Math.max(0, Math.min(...indexes.map(i => kids[i].getBoundingClientRect().top)) - box.top - (options.padTop ?? 18));
    bottom = Math.min(page.offsetHeight, Math.max(...indexes.map(i => kids[i].getBoundingClientRect().bottom)) - box.top + (options.padBottom ?? 18));
  }
  if (options.maxHeight) bottom = Math.min(bottom, top + options.maxHeight);
  // Leave out the vertical ruler at the left edge of the frame: start at the document page.
  const sheet = document.querySelector("[contenteditable=true]")!.getBoundingClientRect(), left = Math.max(0, Math.round((sheet.left - box.left) * scale)), width = Math.min(full.width - left, Math.round(sheet.width * scale) + 4);
  const crop = document.createElement("canvas"); crop.width = width; crop.height = Math.round((bottom - top) * scale);
  crop.getContext("2d")!.drawImage(full, left, Math.round(top * scale), width, crop.height, 0, 0, width, crop.height);
  const url = crop.toDataURL("image/jpeg", 0.85);
  return { ...(await writeSolutionImage(name, url)), width: crop.width, height: crop.height, length: url.length };
}

declare global { interface Window { __saveToLive: (versionId: string, model: unknown, rules: Parameters<typeof generateWordEfficiencyGradingRulesFromModelAnswer>[1]) => Promise<unknown>; __snapshots: unknown[]; __initial: unknown; __buildRules: () => unknown } }

// A hidden browser tab runs no animation frames, and the editor remembers the
// selection on the next frame -- so when this tab is in the background every
// tool acts on a stale selection. Run frames on a timer here instead.
if (typeof window !== "undefined") {
  window.requestAnimationFrame = ((callback: FrameRequestCallback) => window.setTimeout(() => callback(performance.now()), 16)) as typeof window.requestAnimationFrame;
  // Exactly what model-answer-editor.tsx does: each save is one question; its
  // criteria are the diff from the previous save, valued from the final document.
  // Saves through the admin Model Answer page's own server actions (the signed-in admin session).
  window.__saveToLive = async (versionId, model, rules) => ({ model: await saveWordEfficiencyModelAnswer(versionId, model), rules: await generateWordEfficiencyGradingRulesFromModelAnswer(versionId, rules) });
  (window as unknown as { __grade: typeof gradeAgainstLive }).__grade = gradeAgainstLive;
  (window as unknown as { __fixture: typeof writeHarnessFixture }).__fixture = writeHarnessFixture;
  (window as unknown as { __cap: typeof captureSolution }).__cap = captureSolution;
  (window as unknown as { __applyLayout: typeof applySavedPageLayout }).__applyLayout = applySavedPageLayout;
  window.__buildRules = () => {
    const saves = (window.__snapshots ?? []).map((snapshot) => stripBlankParagraphs(snapshot));
    const before = [window.__initial, ...saves];
    const model = saves[saves.length - 1];
    const questions = saves.map((after, index) => diffWordDocuments(before[index], after).map((change) => ({ target: change.target, savedValue: change.expectedValue, caseOnly: change.caseOnly })));
    return { model, criteria: questions.map((list) => modelAnswerRuleCriteria(model, list)) };
  };
}

export function Harness({ original, capabilities, questions, initial = null }: { initial?: unknown; original: WorkingMatterSnapshot; capabilities: unknown; questions: Parameters<typeof QuestionBar>[0]["questions"] }) {
  const [current, setCurrent] = useState(0);
  if (typeof window !== "undefined") (window as unknown as { __given: unknown }).__given = initial;
  // Like the real exam page: its timer re-renders the workspace every second.
  const [tick, setTick] = useState(0);
  useEffect(() => { const id = setInterval(() => setTick(t => t + 1), 1000); return () => clearInterval(id); }, []);
  return (
    <main className="min-h-screen bg-slate-100 p-4" data-tick={tick}>
      <RichDocumentEditor
        attemptId="00000000-0000-0000-0000-000000000000"
        original={original}
        initialDocument={initial as never}
        capabilities={capabilities}
        locked={false}
        mode="authoring"
        oneTimeSubmit={false}
        submitLabel="Save answer"
        submitConfirmMessage={null}
        autosaveAction={async () => ({ ok: true, error: "" })}
        submitAction={async (_id: string, document: unknown) => { (window.__snapshots ??= []).push(document); return { ok: true, error: "" }; }}
        questionBar={<QuestionBar questions={questions} current={current} onSelect={setCurrent} language="English" />}
        onReady={(snapshot: unknown) => { window.__initial = stripBlankParagraphs(snapshot); }}
      />
    </main>
  );
}
