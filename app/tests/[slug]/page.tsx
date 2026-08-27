import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { managedVersionToPreset, type ManagedTestVersion } from "@/lib/admin-tests";
import { liveTestState } from "@/lib/live-tests";
import { ConfigurableTypingExam } from "@/app/typing/_components/configurable-typing-exam";

export default async function PublishedTestPage({params}:PageProps<"/tests/[slug]">){
  const slug=(await params).slug; const supabase=await createClient();
  const[{data:test},{data:{user}}]=await Promise.all([
    supabase.from("tests").select("id,slug,current_version_id,status,visibility,mode,language,input_system_id,is_live,live_starts_at,live_ends_at,results_publish_at").eq("slug",slug).maybeSingle(),
    supabase.auth.getUser(),
  ]);
  if(!test?.current_version_id)notFound();
  if(!test.is_live&&test.status==="published"&&test.visibility==="public"&&(test.mode==="practice"||test.mode==="stenography")){
    const category=test.mode==="stenography"?(test.language==="Hindi"?"hindi-stenography":"english-stenography"):(test.language==="Hindi"?"hindi":"english");
    const input=test.language==="Hindi"?`input=${encodeURIComponent(test.input_system_id)}&`:"";
    redirect(`/typing/practice/${category}?${input}test=${encodeURIComponent(test.slug)}`);
  }
  const schedule={isLive:Boolean(test.is_live),startsAt:test.live_starts_at,endsAt:test.live_ends_at,resultsPublishAt:test.results_publish_at};
  const state=liveTestState(schedule);
  if(test.is_live&&!user)redirect(`/login?next=${encodeURIComponent(`/tests/${slug}`)}`);
  if(test.is_live&&state!=="open")return <LiveTestGate title={state==="upcoming"?"This free live test has not started yet.":state==="results-published"?"Results are now available.":"This free live test has closed."} detail={state==="upcoming"?`Starts ${new Date(test.live_starts_at).toLocaleString()}`:state==="results-published"?"Open the live-test centre to view the published leaderboard.":`Results publish ${new Date(test.results_publish_at).toLocaleString()}`}/>;
  const{data:v}=await supabase.from("test_versions").select("*").eq("id",test.current_version_id).maybeSingle();if(!v)notFound();
  const version:ManagedTestVersion={id:v.id,testId:v.test_id,versionNumber:v.version_number,title:v.title,description:v.description??"",slug:test.slug,language:v.language,inputSystemId:v.input_system_id,mode:v.mode,durationSeconds:v.duration_seconds,passage:v.passage,requiredWpm:Number(v.required_wpm),requiredAccuracy:Number(v.required_accuracy),backspaceMode:v.backspace_mode,wordMethod:v.word_method,highlightMode:v.highlight_mode,visibility:v.visibility,audioPath:(v.configuration as Record<string,unknown>|null)?.audio_path as string|null??null};
  const preset=managedVersionToPreset(version);
  if(version.audioPath){const{data:signed}=await supabase.storage.from("stenography-audio").createSignedUrl(version.audioPath,3600);preset.audioUrl=signed?.signedUrl??null;}
  return <ConfigurableTypingExam preset={preset} mode={version.mode==="learn"||version.mode==="practice"?"practice":"exam"} customPreset managedTest={{testId:test.id,versionId:v.id,mode:version.mode,isLive:Boolean(test.is_live),resultsPublishAt:test.results_publish_at}}/>;
}

function LiveTestGate({title,detail}:{title:string;detail:string}){return <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4"><section className="w-full max-w-xl rounded-3xl bg-white p-8 text-center shadow-xl"><p className="text-sm font-black uppercase tracking-widest text-blue-700">Samradhi Classes free live test</p><h1 className="mt-3 text-3xl font-black">{title}</h1><p className="mt-4 text-slate-600">{detail}</p><Link href="/live-test" className="mt-6 inline-block rounded-xl bg-blue-700 px-6 py-3 font-black text-white">Live test centre</Link></section></main>}
