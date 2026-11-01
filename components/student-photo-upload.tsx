"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { setProfilePhoto } from "@/app/student/photo-actions";
import { createClient } from "@/lib/supabase/client";

const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

// A student's photo with Upload / Change / Remove: used on the student's own profile and on the admin's student page.
// The file goes to the private "student-photos" bucket under "<student id>/…" (JPEG, PNG or WebP, up to 2 MB).
export function StudentPhotoUpload({ studentId, photoUrl, initials }: { studentId: string; photoUrl: string | null; initials: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const upload = async (file: File | undefined) => {
    if (!file) return;
    const extension = TYPES[file.type];
    if (!extension) { setMessage({ text: "Choose a JPG, PNG or WebP photo.", ok: false }); return; }
    if (file.size > 2 * 1024 * 1024) { setMessage({ text: "The photo must be 2 MB or smaller.", ok: false }); return; }
    setBusy(true); setMessage(null);
    const path = `${studentId}/photo-${Date.now()}.${extension}`;
    const { error } = await createClient().storage.from("student-photos").upload(path, file, { contentType: file.type, upsert: false });
    if (error) { setBusy(false); setMessage({ text: /bucket/i.test(error.message) ? "Photos need the database update first (migration 202611011100)." : `Upload failed: ${error.message}`, ok: false }); return; }
    const saved = await setProfilePhoto(studentId, path);
    setBusy(false);
    setMessage(saved.ok ? { text: "Photo saved.", ok: true } : { text: saved.error ?? "Could not save the photo.", ok: false });
    if (saved.ok) router.refresh();
  };
  const remove = async () => {
    setBusy(true); setMessage(null);
    const saved = await setProfilePhoto(studentId, null);
    setBusy(false);
    setMessage(saved.ok ? { text: "Photo removed.", ok: true } : { text: saved.error ?? "Could not remove the photo.", ok: false });
    if (saved.ok) router.refresh();
  };
  return (
    <div className="flex items-center gap-4">
      {photoUrl
        ? <img src={photoUrl} alt="Student photo" className="h-28 w-24 rounded-lg border-2 border-slate-300 object-cover" />
        : <div aria-label="No photo yet" className="grid h-28 w-24 place-items-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 text-2xl font-black text-slate-500">{initials}</div>}
      <div className="grid gap-2">
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => { void upload(event.target.files?.[0]); event.target.value = ""; }} />
        <button type="button" disabled={busy} onClick={() => input.current?.click()} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-black text-white disabled:opacity-50">{busy ? "Saving…" : photoUrl ? "Change photo" : "Upload photo"}</button>
        {photoUrl && <button type="button" disabled={busy} onClick={() => { void remove(); }} className="rounded-xl border border-red-200 px-4 py-2 text-sm font-black text-red-700 disabled:opacity-50">Remove photo</button>}
        <p className="text-xs text-slate-500">Passport-style photo, JPG / PNG / WebP, up to 2 MB. Shown on your live exam screen.</p>
        {message && <p role={message.ok ? "status" : "alert"} className={`text-xs font-bold ${message.ok ? "text-green-700" : "text-red-700"}`}>{message.text}</p>}
      </div>
    </div>
  );
}
