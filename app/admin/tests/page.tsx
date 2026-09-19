import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { BackButton } from "@/app/_components/back-button";
import TestManager, { type ManagedTestRow } from "./test-manager";

export default async function AdminTestsPage() {
  const { user } = await requireAdmin(); const supabase = await createClient();
  let { data: tests, error } = await supabase.from("tests").select("id,title,slug,description,language,status,mode,input_system_id,visibility,duration_seconds,current_version_id,current_version_number,updated_at,is_live,live_starts_at,live_ends_at,results_publish_at,results_delay_minutes,created_by,created_at").order("updated_at",{ascending:false});
  if (error) {
    const fallback = await supabase.from("tests").select("id,title,slug,description,language,status,mode,input_system_id,visibility,duration_seconds,current_version_id,current_version_number,updated_at,created_by,created_at").order("updated_at",{ascending:false});
    tests = (fallback.data ?? []).map((test) => ({ ...test, is_live: false, live_starts_at: null, live_ends_at: null, results_publish_at: null, results_delay_minutes: null }));
    error = fallback.error;
  }
  const ids=(tests??[]).map((test)=>test.id); const versionIds=(tests??[]).flatMap((test)=>test.current_version_id?[test.current_version_id]:[]);
  const creatorIds=[...new Set((tests??[]).flatMap((test)=>test.created_by?[test.created_by]:[]))];
  const [{data:versions},{data:attempts},{data:creators}] = await Promise.all([
    versionIds.length ? supabase.from("test_versions").select("*").in("id",versionIds) : Promise.resolve({data:[]}),
    ids.length ? supabase.from("test_attempts").select("test_id").in("test_id",ids) : Promise.resolve({data:[]}),
    creatorIds.length ? supabase.from("profiles").select("id,full_name").in("id",creatorIds) : Promise.resolve({data:[]}),
  ]);
  const versionMap=new Map((versions??[]).map((version)=>[version.id,version])); const attemptCounts=new Map<string,number>();
  const creatorNameMap=new Map((creators??[]).map((profile)=>[profile.id,profile.full_name]));
  for(const attempt of attempts??[]) attemptCounts.set(attempt.test_id,(attemptCounts.get(attempt.test_id)??0)+1);
  const rows=(tests??[]).map((test)=>({...test,currentVersion:test.current_version_id?versionMap.get(test.current_version_id)??null:null,attempts:attemptCounts.get(test.id)??0,creatorName:test.created_by?creatorNameMap.get(test.created_by)??null:null})) as ManagedTestRow[];
  return <main className="assessment-studio min-h-screen bg-[#eef1f8]"><header className="relative overflow-hidden bg-slate-950 text-white"><div className="absolute -left-16 top-0 h-64 w-64 rounded-full bg-violet-600/25 blur-3xl"/><div className="absolute right-0 bottom-0 h-64 w-64 rounded-full bg-blue-600/20 blur-3xl"/><div className="relative mx-auto max-w-[1500px] px-4 py-10 sm:px-6"><BackButton href="/admin" label="Admin command center" dark /><div className="mt-5 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><span className="rounded-full border border-violet-300/20 bg-violet-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-violet-200">Assessment Studio</span><h1 className="mt-4 text-4xl font-black tracking-tight">Build, publish and control tests.</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">A versioned workspace for practice tests, exam simulations, stenography and scheduled assessments.</p></div><div className="grid grid-cols-3 gap-2"><StudioMetric value={String(rows.length)} label="Tests"/><StudioMetric value={String(rows.filter((row)=>row.status==="published").length)} label="Published"/><StudioMetric value={String(rows.reduce((sum,row)=>sum+row.attempts,0))} label="Attempts"/></div></div></div></header><div className="relative mx-auto -mt-1 max-w-[1500px] px-4 py-7 sm:px-6">{error&&<p className="mb-4 rounded-xl bg-amber-100 p-3 text-sm font-bold text-amber-900">The test catalogue could not be loaded from the database.</p>}<TestManager tests={rows} currentAdminId={user.id}/></div><style>{`.assessment-studio>div>div>section{border:1px solid #e2e8f0;border-radius:24px;box-shadow:0 18px 45px rgba(30,41,59,.08)}.assessment-studio aside{border:1px solid #ddd6fe;border-radius:24px;box-shadow:0 18px 45px rgba(76,29,149,.12);overflow:hidden}.assessment-studio aside>div:first-child{margin:-1.25rem -1.25rem 1rem;padding:1.1rem 1.25rem;background:linear-gradient(135deg,#4c1d95,#6d28d9);color:white}.assessment-studio .input{border-radius:12px;background:#f8fafc}.assessment-studio .input:focus{background:white;outline-color:#7c3aed}`}</style></main>;
}

function StudioMetric({value,label}:{value:string;label:string}) { return <div className="min-w-24 rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-center backdrop-blur"><strong className="block text-xl font-black text-violet-300">{value}</strong><span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</span></div>; }
