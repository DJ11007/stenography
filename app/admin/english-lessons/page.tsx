import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { KEY_LESSONS, PARAGRAPHS, WORD_SETS } from "@/lib/english-tutor-content";
import { BackButton } from "../../_components/back-button";
import { EnglishLessonsManager } from "./english-lessons-manager";

export const metadata: Metadata = { title: "English Typing Tutor | Admin" };

// The built-in curriculum, shown read-only until the 202609111530
// migration has run (which seeds these same rows into the DB and makes
// them editable).
const BUNDLED = [
  ...KEY_LESSONS.map((l, i) => ({ id: `bundled-l-${i}`, kind: "key-lesson" as const, title: l.title, content: l.drills.join("\n"), focus_keys: l.focusKeys.join(" "), is_published: true, display_order: i })),
  ...WORD_SETS.map((s, i) => ({ id: `bundled-w-${i}`, kind: "word-set" as const, title: s.title, content: s.words.join(" "), focus_keys: null, is_published: true, display_order: 100 + i })),
  ...PARAGRAPHS.map((p, i) => ({ id: `bundled-p-${i}`, kind: "paragraph" as const, title: p.title, content: p.text, focus_keys: null, is_published: true, display_order: 200 + i })),
];

export default async function AdminEnglishLessonsPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_english_tutor_exercises");
  const dbReady = !error && Array.isArray(data) && data.length > 0;

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-4xl">
        <BackButton href="/admin" label="Admin panel" />
        <h1 className="mt-5 text-2xl font-black text-slate-950">English Typing Tutor</h1>
        <p className="mt-2 text-sm text-slate-600">
          Edit the key drills, word sets and paragraphs students practise on the English learn
          simulator (<code>/typing/learn/english-tutor</code>). There is no font conversion here --
          content is typed exactly as written. Add as many words / lines / paragraphs as you like.
        </p>
        {!dbReady && (
          <p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm font-bold text-amber-900">
            Showing the built-in course below (read-only). Deploy database migration
            <code className="mx-1">202609111530_english_tutor_exercises</code> — it copies these into
            the database and turns on editing here. Until then students see this exact curriculum.
          </p>
        )}
        <div className="mt-6">
          <EnglishLessonsManager rows={dbReady ? data : BUNDLED} dbReady={dbReady} />
        </div>
      </div>
    </main>
  );
}
