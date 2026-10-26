"use client";
import { useState } from "react";
import { QuestionContentEditor, type QuestionTypingLanguage } from "./question-content-editor";

// The "Paper solution" box of a question in the Word and Excel admin question editors: solution steps (the same
// text format as questions: bold, lists, tables) and one screenshot. Students see it from their result page
// (migrations 202610261000 and 202610261200). The screenshot is resized here to a small JPEG data URI.
export type SolutionPatch = { solution?: string | null; solution_image?: string | null };
const MAX_IMAGE_LENGTH = 690000;

export function SolutionFields({ number, solution, image, typing, onTypingChange, onChange }: { number: number; solution: string | null | undefined; image: string | null | undefined; typing: QuestionTypingLanguage; onTypingChange: (value: QuestionTypingLanguage) => void; onChange: (patch: SolutionPatch) => void }) {
  const [problem, setProblem] = useState<string | null>(null);
  const pick = (file: File | null) => {
    setProblem(null);
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) { setProblem("Choose a PNG, JPG or WebP picture."); return; }
    const url = URL.createObjectURL(file), picture = new Image();
    picture.onload = () => {
      const scale = Math.min(1, 1000 / picture.width), canvas = document.createElement("canvas");
      canvas.width = Math.round(picture.width * scale); canvas.height = Math.round(picture.height * scale);
      const context = canvas.getContext("2d");
      if (context) { context.fillStyle = "#ffffff"; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(picture, 0, 0, canvas.width, canvas.height); }
      URL.revokeObjectURL(url);
      const data = canvas.toDataURL("image/jpeg", 0.82);
      if (data.length > MAX_IMAGE_LENGTH) { setProblem("This picture is too large even after resizing; crop it and try again."); return; }
      onChange({ solution_image: data });
    };
    picture.onerror = () => { URL.revokeObjectURL(url); setProblem("This picture could not be read."); };
    picture.src = url;
  };
  return (
    <fieldset className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3">
      <legend className="px-1 text-sm font-black text-emerald-900">Paper solution (shown to students after they submit)</legend>
      <QuestionContentEditor ariaLabel={`Question ${number} solution steps`} required={false} value={solution ?? ""} onChange={(value) => onChange({ solution: value })} typing={typing} onTypingChange={onTypingChange} />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="cursor-pointer rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-sm font-bold text-emerald-900">{image ? "Replace screenshot" : "Add screenshot"}<input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => { pick(event.target.files?.[0] ?? null); event.target.value = ""; }} /></label>
        {image && <button type="button" onClick={() => onChange({ solution_image: null })} className="text-sm font-bold text-red-700">Remove screenshot</button>}
        {problem && <span role="alert" className="text-sm font-bold text-red-700">{problem}</span>}
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element -- a resized image data URI, not a static file */}
      {image && <img src={image} alt={`Solution screenshot for question ${number}`} className="mt-3 max-h-72 rounded-lg border border-emerald-200" />}
    </fieldset>
  );
}

