import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { managedVersionToPreset, type ManagedTestVersion } from "@/lib/admin-tests";
import { liveTestState } from "@/lib/live-tests";
import { formatIST } from "@/lib/format-datetime";
import { ConfigurableTypingExam } from "@/app/typing/_components/configurable-typing-exam";
import { TypingStudentProvider } from "@/app/typing/_components/typing-student-provider";
import { FreeExamLimitPaywall } from "@/app/typing/exams/_components/free-exam-limit-paywall";

export default async function PublishedTestPage({params,searchParams}:PageProps<"/tests/[slug]">){
  const slug=(await params).slug; const supabase=await createClient();
  // Set by a shared-exercise link on any exam category's page (see
  // app/typing/exams/category/[slug]/[language]/page.tsx, which now shares
  // every exam exercise into every other category's list) -- resolved
  // against the fixed EXAM_CATEGORIES list inside managedVersionToPreset(),
  // so an invalid/absent/tampered value just falls back to today's exact
  // native behaviour.
  const viewAsRaw=(await searchParams)?.viewAs; const viewAs=typeof viewAsRaw==="string"?viewAsRaw:undefined;
  const[{data:test},{data:{user}}]=await Promise.all([
    supabase.from("tests").select("id,slug,current_version_id,status,visibility,mode,language,input_system_id,is_live,live_starts_at,live_ends_at,results_publish_at").eq("slug",slug).maybeSingle(),
    supabase.auth.getUser(),
  ]);
  if(!test?.current_version_id)notFound();
  // Everything past this point (exam/learn tests, and live tests) renders
  // the same exam workspace as every /typing/* route, which needs the
  // signed-in user's identity for TypingBrandHeader (name/email/sign-out
  // menu) via useTypingStudent(). /typing/layout.tsx supplies that
  // context for every route nested under /typing -- this route lives
  // outside that layout, so without its own login gate and its own
  // TypingStudentProvider here, that header throws "Typing student
  // context is unavailable." and the whole page 500s. Unlike the
  // admin-redirecting login check /typing/layout.tsx uses, this
  // deliberately does not send admins to /admin -- an admin opening this
  // exact link to preview/trial their own just-published test is a
  // normal, expected use of it.
  if(!user)redirect(`/login?next=${encodeURIComponent(`/tests/${slug}`)}`);
  const{data:profile}=await supabase.from("profiles").select("full_name,phone,role").eq("id",user.id).maybeSingle();
  const isAdmin=profile?.role==="admin";
  // Real gap this closed: an admin previewing their own practice/
  // stenography test used to get redirected here into /typing/practice/...
  // same as a student -- but that route lives under /typing/layout.tsx's
  // student-only access gate, which bounced the admin straight to /admin,
  // making "preview my own test" impossible for exactly these two modes
  // (exam/learn/live tests never had this problem, since they render
  // directly below instead of redirecting). Only skip the redirect for an
  // actual admin; a student hitting this same link still gets the real
  // Task Library experience (Prev/Next between tests, Newest/Oldest sort)
  // instead of landing on one isolated test.
  if(!isAdmin&&!test.is_live&&test.status==="published"&&test.visibility==="public"&&(test.mode==="practice"||test.mode==="stenography")){
    const category=test.mode==="stenography"?(test.language==="Hindi"?"hindi-stenography":"english-stenography"):(test.language==="Hindi"?"hindi":"english");
    const input=test.language==="Hindi"?`input=${encodeURIComponent(test.input_system_id)}&`:"";
    redirect(`/typing/practice/${category}?${input}test=${encodeURIComponent(test.slug)}`);
  }
  // The Typing Exam Simulator's free-attempt cap (mode="exam" only, a free
  // scheduled live test is unaffected) -- checked here, before the exam
  // workspace ever renders, exactly like PracticeNavigator's own pre-render
  // check for "Take Tests". Applies identically to English and Hindi. An
  // admin's own preview is exempt -- it would be strange for the admin who
  // sets that very limit to burn their own attempt count checking a test
  // they just wrote.
  const examFreeStatus=test.mode==="exam"&&!test.is_live&&!isAdmin
    ?await supabase.rpc("exam_test_free_status").single() as unknown as {data:{used_count:number;free_limit:number|null;remaining:number|null;blocked:boolean}|null}
    :{data:null};
  // Real bug: this early return renders TypingBrandHeader (via
  // FreeExamLimitPaywall) without the TypingStudentProvider wrap the final
  // return below supplies -- useTypingStudent() then throws "Typing
  // student context is unavailable" and the whole page 500s for any
  // student who has actually used up their free exam attempts.
  const studentIdentity={name:profile?.full_name?.trim()||"Student",email:user.email||"",phone:profile?.phone||user.phone||null};
  if(examFreeStatus.data?.blocked)return <TypingStudentProvider student={studentIdentity}><FreeExamLimitPaywall used={examFreeStatus.data.used_count} limit={examFreeStatus.data.free_limit??0}/></TypingStudentProvider>;
  const schedule={isLive:Boolean(test.is_live),startsAt:test.live_starts_at,endsAt:test.live_ends_at,resultsPublishAt:test.results_publish_at};
  const state=liveTestState(schedule);
  if(test.is_live&&state!=="open")return <LiveTestGate title={state==="upcoming"?"This free live test has not started yet.":state==="results-published"?"Results are now available.":"This free live test has closed."} detail={state==="upcoming"?`Starts ${formatIST(test.live_starts_at)}`:state==="results-published"?"Open the live-test centre to view the published leaderboard.":`Results publish ${formatIST(test.results_publish_at)}`}/>;
  const{data:v}=await supabase.from("test_versions").select("*").eq("id",test.current_version_id).maybeSingle();if(!v)notFound();
  const configuration=v.configuration as Record<string,unknown>|null;
  const version:ManagedTestVersion={id:v.id,testId:v.test_id,versionNumber:v.version_number,title:v.title,description:v.description??"",slug:test.slug,language:v.language,inputSystemId:v.input_system_id,mode:v.mode,durationSeconds:v.duration_seconds,passage:v.passage,requiredWpm:Number(v.required_wpm),requiredAccuracy:Number(v.required_accuracy),backspaceMode:v.backspace_mode,wordMethod:v.word_method,highlightMode:v.highlight_mode,visibility:v.visibility,audioPath:configuration?.audio_path as string|null??null,pdfPath:configuration?.pdf_path as string|null??null,pdfFileName:configuration?.pdf_file_name as string|null??null,dictationCategories:configuration?.dictation_categories as ManagedTestVersion["dictationCategories"]??null,examCategory:configuration?.exam_category as string|null??null};
  const preset=managedVersionToPreset(version,viewAs);
  if(version.audioPath){const{data:signed}=await supabase.storage.from("stenography-audio").createSignedUrl(version.audioPath,3600);preset.audioUrl=signed?.signedUrl??null;}
  if(version.pdfPath){const{data:signed}=await supabase.storage.from("managed-test-pdfs").createSignedUrl(version.pdfPath,3600);preset.pdfUrl=signed?.signedUrl??null;}
  return <TypingStudentProvider student={studentIdentity}>
    <ConfigurableTypingExam preset={preset} mode={version.mode==="learn"||version.mode==="practice"?"practice":"exam"} customPreset managedTest={{testId:test.id,versionId:v.id,mode:version.mode,isLive:Boolean(test.is_live),resultsPublishAt:test.results_publish_at}} adminPreview={isAdmin}/>
  </TypingStudentProvider>;
}

function LiveTestGate({title,detail}:{title:string;detail:string}){return <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4"><section className="w-full max-w-xl rounded-3xl bg-white p-8 text-center shadow-xl"><p className="text-sm font-black uppercase tracking-widest text-blue-700">Samradhi Classes free live test</p><h1 className="mt-3 text-3xl font-black">{title}</h1><p className="mt-4 text-slate-600">{detail}</p><Link href="/live-test" className="mt-6 inline-block rounded-xl bg-blue-700 px-6 py-3 font-black text-white">Live test centre</Link></section></main>}
