"use client";
import { useActionState, useRef, useState, useTransition } from "react";
import { deleteCoursePackage, deleteFeedback, deleteOfficialWebsite, deleteVacancyNotice, extractVacancyDraft, saveCoursePackage, saveOfficialWebsite, saveVacancyNotice, setFeedbackApproved, type HomepageActionState } from "./actions";
import type { ExtractedVacancyDraft } from "@/lib/vacancy-extraction";

type CoursePackageRow = { id: string; title: string; duration_label: string; price_label: string; original_price_label: string | null; features: string[]; coupon_code: string | null; coupon_description: string | null; is_popular: boolean; is_published: boolean; display_order: number };
type VacancyNoticeRow = { id: string; slug: string; category: "jobs" | "admit-cards" | "results"; title: string; organization: string; summary: string; status: string; important_dates: string[]; application_fees: string[]; eligibility: string[]; age_limit: string[]; notification_url: string | null; official_url: string | null; is_published: boolean; display_order: number; vacancy_breakdown: { postName: string; totalPosts: string; eligibility: string }[]; useful_links: { label: string; url: string }[]; notice_documents: { label: string; url: string }[] };
type FeedbackRow = { id: string; display_name: string; rating: number | null; message: string; is_approved: boolean; created_at: string };
type OfficialWebsiteRow = { id: string; name: string; url: string; description: string; is_published: boolean; display_order: number };

const initial: HomepageActionState = {};
const TABS = [
  { id: "Course Packages", icon: "🎓" },
  { id: "Vacancy Notices", icon: "📋" },
  { id: "Feedback", icon: "💬" },
  { id: "Official Websites", icon: "🔗" },
] as const;

export function HomepageContentManager({ coursePackages, vacancyNotices, feedback, officialWebsites }: { coursePackages: CoursePackageRow[]; vacancyNotices: VacancyNoticeRow[]; feedback: FeedbackRow[]; officialWebsites: OfficialWebsiteRow[] }) {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("Course Packages");
  const pendingCount = feedback.filter((row) => !row.is_approved).length;
  return (
    <div className="rounded-3xl bg-white p-5 shadow-sm sm:p-7">
      <div role="tablist" className="flex flex-wrap gap-2 border-b border-slate-200 pb-4">
        {TABS.map((item) => (
          <button key={item.id} role="tab" aria-selected={tab === item.id} type="button" onClick={() => setTab(item.id)} className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black transition ${tab === item.id ? "bg-blue-700 text-white shadow" : "bg-slate-50 text-slate-600 hover:bg-slate-100"}`}>
            <span aria-hidden>{item.icon}</span>{item.id}
            {item.id === "Feedback" && pendingCount > 0 && <span className="rounded-full bg-amber-400 px-1.5 py-0.5 text-[10px] font-black text-amber-950">{pendingCount}</span>}
          </button>
        ))}
      </div>
      <div className="mt-6">
        {tab === "Course Packages" && <CoursePackagesTab rows={coursePackages} />}
        {tab === "Vacancy Notices" && <VacancyNoticesTab rows={vacancyNotices} />}
        {tab === "Feedback" && <FeedbackTab rows={feedback} />}
        {tab === "Official Websites" && <OfficialWebsitesTab rows={officialWebsites} />}
      </div>
    </div>
  );
}

function FeedbackMessage({ state }: { state: HomepageActionState }) {
  if (!state.error && !state.success) return null;
  return <p role="status" className={`mt-2 text-sm font-bold ${state.error ? "text-red-700" : "text-green-700"}`}>{state.error ?? state.success}</p>;
}

function CoursePackagesTab({ rows }: { rows: CoursePackageRow[] }) {
  const [editing, setEditing] = useState<CoursePackageRow | "new" | null>(null);
  const [state, action, pending] = useActionState(saveCoursePackage, initial);
  const [deleteState, deleteAction] = useActionState(deleteCoursePackage, initial);
  const draft = editing === "new" ? null : editing;
  return (
    <div>
      <button type="button" onClick={() => setEditing("new")} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-black text-white hover:bg-blue-800">+ Add course package</button>
      <div className="mt-4 grid gap-3">
        {rows.length === 0 && <p className="text-sm text-slate-500">No course packages yet.</p>}
        {rows.map((row) => (
          <div key={row.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
            <div><p className="font-black">{row.title} — {row.duration_label} — {row.price_label}{!row.is_published && <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-xs font-bold text-slate-600">Hidden</span>}{row.is_popular && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">Popular</span>}</p><p className="mt-1 text-xs text-slate-500">{row.features.join(" · ") || "No features listed"}</p></div>
            <div className="flex shrink-0 gap-2">
              <button type="button" onClick={() => setEditing(row)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-black hover:bg-slate-50">Edit</button>
              <form action={deleteAction}><input type="hidden" name="id" value={row.id} /><button type="submit" className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-black text-red-700 hover:bg-red-50">Delete</button></form>
            </div>
          </div>
        ))}
      </div>
      <FeedbackMessage state={deleteState} />
      {editing && (
        <form action={action} className="mt-5 grid gap-3 rounded-xl border border-blue-200 bg-blue-50/40 p-5 sm:grid-cols-2">
          <input type="hidden" name="id" value={draft?.id ?? ""} />
          <label className="text-xs font-bold">Title<input name="title" defaultValue={draft?.title ?? "Samradhi Complete Course"} className="input mt-1 w-full" required /></label>
          <label className="text-xs font-bold">Duration label<input name="durationLabel" defaultValue={draft?.duration_label ?? ""} placeholder="6 Months" className="input mt-1 w-full" required /></label>
          <label className="text-xs font-bold">Price label<input name="priceLabel" defaultValue={draft?.price_label ?? ""} placeholder="₹599" className="input mt-1 w-full" required /></label>
          <label className="text-xs font-bold">Original price (optional, shown struck through)<input name="originalPriceLabel" defaultValue={draft?.original_price_label ?? ""} placeholder="₹799" className="input mt-1 w-full" /></label>
          <label className="text-xs font-bold sm:col-span-2">Features (one per line)<textarea name="features" defaultValue={(draft?.features ?? []).join("\n")} rows={4} className="input mt-1 w-full" /></label>
          <label className="text-xs font-bold">Coupon code (optional)<input name="couponCode" defaultValue={draft?.coupon_code ?? ""} placeholder="SAVE100" className="input mt-1 w-full" /></label>
          <label className="text-xs font-bold">Coupon description<input name="couponDescription" defaultValue={draft?.coupon_description ?? ""} placeholder="Flat ₹100 off" className="input mt-1 w-full" /></label>
          <label className="text-xs font-bold">Display order<input name="displayOrder" type="number" defaultValue={draft?.display_order ?? 0} className="input mt-1 w-full" /></label>
          <div className="flex items-end gap-4">
            <label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" name="isPopular" defaultChecked={draft?.is_popular ?? false} /> Most popular</label>
            <label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" name="isPublished" defaultChecked={draft?.is_published ?? true} /> Published</label>
          </div>
          <div className="flex gap-2 sm:col-span-2">
            <button type="submit" disabled={pending} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-black text-white hover:bg-blue-800 disabled:opacity-60">{pending ? "Saving…" : "Save"}</button>
            <button type="button" onClick={() => setEditing(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-black hover:bg-slate-50">Cancel</button>
          </div>
          <div className="sm:col-span-2"><FeedbackMessage state={state} /></div>
        </form>
      )}
    </div>
  );
}

const CATEGORIES = ["jobs", "admit-cards", "results"] as const;
const CATEGORY_LABELS: Record<(typeof CATEGORIES)[number], string> = { jobs: "Latest Jobs", "admit-cards": "Admit Cards", results: "Results" };

function extractedToDraftRow(extracted: ExtractedVacancyDraft): VacancyNoticeRow {
  return {
    id: "", slug: "", category: extracted.category, title: extracted.title, organization: extracted.organization,
    summary: extracted.summary, status: extracted.status, important_dates: extracted.importantDates, application_fees: extracted.applicationFees,
    eligibility: extracted.eligibility, age_limit: extracted.ageLimit, notification_url: extracted.notificationUrl, official_url: extracted.officialUrl,
    is_published: true, display_order: 0, vacancy_breakdown: extracted.vacancyBreakdown, useful_links: extracted.usefulLinks,
    notice_documents: [],
  };
}

function ExtractFromDocument({ onExtracted }: { onExtracted: (draft: VacancyNoticeRow) => void }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  const runExtraction = (formData: FormData) => {
    setError(null);
    startTransition(async () => {
      const result = await extractVacancyDraft(formData);
      if (!result.ok) { setError(result.error); return; }
      onExtracted(extractedToDraftRow(result.draft));
      if (fileInput.current) fileInput.current.value = "";
      setUrl("");
    });
  };

  const runFromFile = () => {
    const file = fileInput.current?.files?.[0];
    if (!file) { setError("Choose a PDF or image first."); return; }
    const formData = new FormData();
    formData.set("extractionFile", file);
    runExtraction(formData);
  };

  const runFromUrl = () => {
    if (!url.trim()) { setError("Paste a notice URL first."); return; }
    const formData = new FormData();
    formData.set("extractionUrl", url.trim());
    runExtraction(formData);
  };

  return (
    <div className="mt-3 grid gap-2 rounded-xl border border-dashed border-blue-300 bg-blue-50/60 p-3">
      <span className="text-xs font-black text-blue-900">✨ AI auto-fill — reads the facts (dates, fees, eligibility) into the form for you to review; it never copies another site's page onto ours</span>
      <div className="flex flex-wrap items-center gap-2">
        <input ref={fileInput} type="file" accept="application/pdf,image/png,image/jpeg,image/webp" className="text-xs" />
        <button type="button" onClick={runFromFile} disabled={pending} className="rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-black text-white hover:bg-blue-800 disabled:opacity-60">{pending ? "Reading…" : "Extract from PDF/Image"}</button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://www.sarkariresult.com/2026/…" className="input flex-1 text-xs" />
        <button type="button" onClick={runFromUrl} disabled={pending} className="rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-black text-white hover:bg-blue-800 disabled:opacity-60">{pending ? "Reading…" : "Extract from URL"}</button>
      </div>
      {error && <p role="alert" className="text-xs font-bold text-red-700">{error}</p>}
    </div>
  );
}

function DocumentsField({ initial }: { initial: { label: string; url: string }[] }) {
  const [kept, setKept] = useState(initial);
  const [newRows, setNewRows] = useState(1);
  return (
    <div className="sm:col-span-2">
      <span className="text-xs font-bold">Documents &amp; Downloads (PDF) — upload any number, each with its own name</span>
      {kept.length > 0 && (
        <ul className="mt-2 grid gap-1.5">
          {kept.map((doc, index) => (
            <li key={doc.url} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs">
              <a href={doc.url} target="_blank" rel="noopener noreferrer" className="font-bold text-blue-700 underline">{doc.label}</a>
              <button type="button" onClick={() => setKept((current) => current.filter((_, i) => i !== index))} className="font-black text-red-700">Remove</button>
            </li>
          ))}
        </ul>
      )}
      <input type="hidden" name="existingDocuments" value={JSON.stringify(kept)} />
      <div className="mt-2 grid gap-2">
        {Array.from({ length: newRows }, (_, index) => (
          <div key={index} className="flex flex-wrap gap-2">
            <input name="documentLabel" placeholder="e.g. Notification PDF" className="input flex-1 text-xs" />
            <input name="documentFile" type="file" accept="application/pdf" className="flex-1 text-xs" />
          </div>
        ))}
      </div>
      <button type="button" onClick={() => setNewRows((count) => count + 1)} className="mt-2 text-xs font-black text-blue-700">+ Add another document</button>
    </div>
  );
}

function VacancyNoticesTab({ rows }: { rows: VacancyNoticeRow[] }) {
  const [editing, setEditing] = useState<VacancyNoticeRow | "new" | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [state, action, pending] = useActionState(saveVacancyNotice, initial);
  const [deleteState, deleteAction] = useActionState(deleteVacancyNotice, initial);
  const draft = editing === "new" ? null : editing;
  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => { setEditing("new"); setFormKey((key) => key + 1); }} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-black text-white hover:bg-blue-800">+ Add vacancy notice</button>
      </div>
      <ExtractFromDocument onExtracted={(draftRow) => { setEditing(draftRow); setFormKey((key) => key + 1); }} />
      <div className="mt-4 grid gap-3">
        {rows.length === 0 && <p className="text-sm text-slate-500">No vacancy notices yet.</p>}
        {rows.map((row) => (
          <div key={row.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
            <div><span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-black text-blue-800">{CATEGORY_LABELS[row.category]}</span>{!row.is_published && <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-xs font-bold text-slate-600">Hidden</span>}<p className="mt-1 font-black">{row.title}</p><p className="mt-0.5 text-xs text-slate-500">{row.organization} · {row.status}</p></div>
            <div className="flex shrink-0 gap-2">
              <button type="button" onClick={() => { setEditing(row); setFormKey((key) => key + 1); }} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-black hover:bg-slate-50">Edit</button>
              <form action={deleteAction}><input type="hidden" name="id" value={row.id} /><button type="submit" className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-black text-red-700 hover:bg-red-50">Delete</button></form>
            </div>
          </div>
        ))}
      </div>
      <FeedbackMessage state={deleteState} />
      {editing && (
        <form key={formKey} action={action} className="mt-5 grid gap-3 rounded-xl border border-blue-200 bg-blue-50/40 p-5 sm:grid-cols-2">
          <input type="hidden" name="id" value={draft?.id ?? ""} />
          <label className="text-xs font-bold">Category<select name="category" defaultValue={draft?.category ?? "jobs"} className="input mt-1 w-full">{CATEGORIES.map((category) => <option key={category} value={category}>{CATEGORY_LABELS[category]}</option>)}</select></label>
          <label className="text-xs font-bold">Title<input name="title" defaultValue={draft?.title ?? ""} className="input mt-1 w-full" required /></label>
          {!draft?.id && <label className="text-xs font-bold">URL slug (optional, auto-generated from title)<input name="slug" placeholder="auto-generated" className="input mt-1 w-full" /></label>}
          <label className="text-xs font-bold">Organization / board<input name="organization" defaultValue={draft?.organization ?? ""} className="input mt-1 w-full" /></label>
          <label className="text-xs font-bold">Status<input name="status" defaultValue={draft?.status ?? ""} placeholder="Applications open" className="input mt-1 w-full" /></label>
          <label className="text-xs font-bold sm:col-span-2">Summary<textarea name="summary" defaultValue={draft?.summary ?? ""} rows={2} className="input mt-1 w-full" /></label>
          <label className="text-xs font-bold">Important dates (one per line)<textarea name="importantDates" defaultValue={(draft?.important_dates ?? []).join("\n")} rows={3} className="input mt-1 w-full" /></label>
          <label className="text-xs font-bold">Application fees (one per line)<textarea name="applicationFees" defaultValue={(draft?.application_fees ?? []).join("\n")} rows={3} className="input mt-1 w-full" /></label>
          <label className="text-xs font-bold">Eligibility (one per line)<textarea name="eligibility" defaultValue={(draft?.eligibility ?? []).join("\n")} rows={3} className="input mt-1 w-full" /></label>
          <label className="text-xs font-bold">Age limit (one per line)<textarea name="ageLimit" defaultValue={(draft?.age_limit ?? []).join("\n")} rows={3} className="input mt-1 w-full" /></label>
          <label className="text-xs font-bold sm:col-span-2">Vacancy Details table — one post per line, as <span className="font-mono">Post Name | Total Posts | Eligibility</span><textarea name="vacancyBreakdown" defaultValue={(draft?.vacancy_breakdown ?? []).map((row) => `${row.postName} | ${row.totalPosts} | ${row.eligibility}`).join("\n")} rows={3} placeholder="Commercial Cum Ticket Clerk | 2424 | 12th pass" className="input mt-1 w-full font-mono text-xs" /></label>
          <label className="text-xs font-bold sm:col-span-2">Useful Links table — one link per line, as <span className="font-mono">Label | https://url</span><textarea name="usefulLinks" defaultValue={(draft?.useful_links ?? []).map((link) => `${link.label} | ${link.url}`).join("\n")} rows={3} placeholder="Download RRB Ajmer Result | https://…" className="input mt-1 w-full font-mono text-xs" /></label>
          <DocumentsField initial={draft?.notice_documents ?? []} />
          <label className="text-xs font-bold">Notification link (PDF or URL)<input name="notificationUrl" type="url" defaultValue={draft?.notification_url ?? ""} placeholder="https://…" className="input mt-1 w-full" /></label>
          <label className="text-xs font-bold">Official apply link<input name="officialUrl" type="url" defaultValue={draft?.official_url ?? ""} placeholder="https://…" className="input mt-1 w-full" /></label>
          <label className="text-xs font-bold">Display order<input name="displayOrder" type="number" defaultValue={draft?.display_order ?? 0} className="input mt-1 w-full" /></label>
          <label className="flex items-end gap-2 text-xs font-bold"><input type="checkbox" name="isPublished" defaultChecked={draft?.is_published ?? true} /> Published</label>
          <div className="flex gap-2 sm:col-span-2">
            <button type="submit" disabled={pending} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-black text-white hover:bg-blue-800 disabled:opacity-60">{pending ? "Saving…" : "Save"}</button>
            <button type="button" onClick={() => setEditing(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-black hover:bg-slate-50">Cancel</button>
          </div>
          <div className="sm:col-span-2"><FeedbackMessage state={state} /></div>
        </form>
      )}
    </div>
  );
}

function FeedbackTab({ rows }: { rows: FeedbackRow[] }) {
  const [approveState, approveAction] = useActionState(setFeedbackApproved, initial);
  const [deleteState, deleteAction] = useActionState(deleteFeedback, initial);
  return (
    <div className="grid gap-3">
      {rows.length === 0 && <p className="text-sm text-slate-500">No feedback submitted yet.</p>}
      {rows.map((row) => (
        <div key={row.id} className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-black">{row.display_name}{row.rating && <span className="ml-2 text-amber-500">{"★".repeat(row.rating)}</span>}<span className={`ml-2 rounded-full px-2 py-0.5 text-[11px] font-bold ${row.is_approved ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>{row.is_approved ? "Visible on site" : "Pending review"}</span></p>
            <div className="flex gap-2">
              <form action={approveAction}><input type="hidden" name="id" value={row.id} /><input type="hidden" name="approved" value={row.is_approved ? "false" : "true"} /><button type="submit" className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-black hover:bg-slate-50">{row.is_approved ? "Hide" : "Approve"}</button></form>
              <form action={deleteAction}><input type="hidden" name="id" value={row.id} /><button type="submit" className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-black text-red-700 hover:bg-red-50">Delete</button></form>
            </div>
          </div>
          <p className="mt-2 text-sm text-slate-700">{row.message}</p>
          <p className="mt-1 text-xs text-slate-400">{new Date(row.created_at).toLocaleString()}</p>
        </div>
      ))}
      <FeedbackMessage state={approveState} />
      <FeedbackMessage state={deleteState} />
    </div>
  );
}

function OfficialWebsitesTab({ rows }: { rows: OfficialWebsiteRow[] }) {
  const [editing, setEditing] = useState<OfficialWebsiteRow | "new" | null>(null);
  const [state, action, pending] = useActionState(saveOfficialWebsite, initial);
  const [deleteState, deleteAction] = useActionState(deleteOfficialWebsite, initial);
  const draft = editing === "new" ? null : editing;
  return (
    <div>
      <p className="text-sm text-slate-600">A curated directory of official examination-authority websites (RSSB, RPSC, SSC, etc.). Clicking these takes the student to the real official site.</p>
      <button type="button" onClick={() => setEditing("new")} className="mt-3 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-black text-white hover:bg-emerald-800">+ Add official website</button>
      <div className="mt-4 grid gap-3">
        {rows.length === 0 && <p className="text-sm text-slate-500">No official websites yet.</p>}
        {rows.map((row) => (
          <div key={row.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
            <div><p className="font-black">{row.name}{!row.is_published && <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-xs font-bold text-slate-600">Hidden</span>}</p><a href={row.url} target="_blank" rel="noopener noreferrer" className="mt-0.5 block text-xs text-emerald-700 underline">{row.url}</a>{row.description && <p className="mt-0.5 text-xs text-slate-500">{row.description}</p>}</div>
            <div className="flex shrink-0 gap-2">
              <button type="button" onClick={() => setEditing(row)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-black hover:bg-slate-50">Edit</button>
              <form action={deleteAction}><input type="hidden" name="id" value={row.id} /><button type="submit" className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-black text-red-700 hover:bg-red-50">Delete</button></form>
            </div>
          </div>
        ))}
      </div>
      <FeedbackMessage state={deleteState} />
      {editing && (
        <form action={action} className="mt-5 grid gap-3 rounded-xl border border-emerald-200 bg-emerald-50/40 p-5 sm:grid-cols-2">
          <input type="hidden" name="id" value={draft?.id ?? ""} />
          <label className="text-xs font-bold">Name<input name="name" defaultValue={draft?.name ?? ""} placeholder="RSSB" className="input mt-1 w-full" required /></label>
          <label className="text-xs font-bold">Website link<input name="url" type="url" defaultValue={draft?.url ?? ""} placeholder="https://rssb.rajasthan.gov.in" className="input mt-1 w-full" required /></label>
          <label className="text-xs font-bold sm:col-span-2">Description (optional)<input name="description" defaultValue={draft?.description ?? ""} placeholder="Rajasthan Staff Selection Board" className="input mt-1 w-full" /></label>
          <label className="text-xs font-bold">Display order<input name="displayOrder" type="number" defaultValue={draft?.display_order ?? 0} className="input mt-1 w-full" /></label>
          <label className="flex items-end gap-2 text-xs font-bold"><input type="checkbox" name="isPublished" defaultChecked={draft?.is_published ?? true} /> Published</label>
          <div className="flex gap-2 sm:col-span-2">
            <button type="submit" disabled={pending} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-black text-white hover:bg-emerald-800 disabled:opacity-60">{pending ? "Saving…" : "Save"}</button>
            <button type="button" onClick={() => setEditing(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-black hover:bg-slate-50">Cancel</button>
          </div>
          <div className="sm:col-span-2"><FeedbackMessage state={state} /></div>
        </form>
      )}
    </div>
  );
}
