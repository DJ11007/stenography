import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { toTypeableKrutiDev } from "@/lib/hindi-font-converter";
import { KEY_LESSONS, PARAGRAPHS, WORD_SETS } from "@/lib/krutidev-tutor-content";
import { BackButton } from "../../_components/back-button";
import { KrutiDevLessonsManager } from "./krutidev-lessons-manager";

// What students actually see: the Unicode content converted to keyboard-typeable
// Kruti Dev bytes, rendered in the Kruti Dev 010 font on the card.
function withKrutiDevPreview<T extends { content: string }>(row: T) {
  let krutidev = "";
  try {
    krutidev = toTypeableKrutiDev(row.content);
  } catch {
    krutidev = "";
  }
  return { ...row, krutidev };
}

export const metadata: Metadata = { title: "Kruti Dev Typing Tutor | Admin" };

// The built-in curriculum, shown read-only until the 202609101600
// migration has run (which seeds these same rows into the DB and makes
// them editable).
const BUNDLED = [
  ...KEY_LESSONS.map((l, i) => ({ id: `bundled-l-${i}`, kind: "key-lesson" as const, title: l.title, content: l.drills.join("\n"), focus_keys: l.focusKeys.join(" "), is_published: true, display_order: i })),
  ...WORD_SETS.map((s, i) => ({ id: `bundled-w-${i}`, kind: "word-set" as const, title: s.title, content: s.words.join(" "), focus_keys: null, is_published: true, display_order: 100 + i })),
  ...PARAGRAPHS.map((p, i) => ({ id: `bundled-p-${i}`, kind: "paragraph" as const, title: p.title, content: p.text, focus_keys: null, is_published: true, display_order: 200 + i })),
];

export default async function AdminKrutiDevLessonsPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_krutidev_exercises");
  const dbReady = !error && Array.isArray(data) && data.length > 0;

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-4xl">
        <BackButton href="/admin" label="Admin panel" />
        <h1 className="mt-5 text-2xl font-black text-slate-950">Kruti Dev Typing Tutor</h1>
        <p className="mt-2 text-sm text-slate-600">
          Edit the key drills, word sets and paragraphs students practise on the Kruti Dev learn
          simulator (<code>/typing/learn/krutidev</code>). Write in normal Unicode Hindi — it is
          converted to Kruti Dev automatically. Add as many words / lines / paragraphs as you like.
        </p>
        {!dbReady && (
          <p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm font-bold text-amber-900">
            Showing the built-in course below (read-only). Deploy database migration
            <code className="mx-1">202609101600_krutidev_tutor_exercises</code> — it copies these into
            the database and turns on editing here. Until then students see this exact curriculum.
          </p>
        )}
        <div className="mt-6">
          <KrutiDevLessonsManager
            rows={(dbReady ? data : BUNDLED).map(withKrutiDevPreview)}
            dbReady={dbReady}
          />
        </div>
      </div>
    </main>
  );
}
