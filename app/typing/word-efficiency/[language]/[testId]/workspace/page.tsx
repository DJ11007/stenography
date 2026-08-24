import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireStudent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { WordWorkspace } from "./word-workspace";

export const metadata:Metadata={title:"Word Efficiency Workspace | Samradhi Classes",description:"Secure Word Efficiency question-delivery and timed workspace."};

export default async function WordWorkspacePage({params,searchParams}:{params:Promise<{language:string;testId:string}>;searchParams:Promise<Record<string,string|undefined>>}){
 const{user}=await requireStudent();const route=await params;const query=await searchParams;const attemptId=query.attempt;
 if(!attemptId)redirect(`/typing/word-efficiency/${route.language}`);
 const supabase=await createClient();const{data:attempt}=await supabase.from("word_efficiency_attempts").select("id,test_id,student_id,status,started_at,snapshot,delivery_method,document_autosave").eq("id",attemptId).eq("student_id",user.id).eq("test_id",route.testId).maybeSingle();
 if(!attempt)notFound();
 if(attempt.status==="submitted"||attempt.status==="completed")redirect(`/typing/word-efficiency/results/${attempt.id}`);
 const snapshot=attempt.snapshot as Parameters<typeof WordWorkspace>[0]["snapshot"];if(snapshot.language.toLowerCase()!==route.language)notFound();
 let signedPdfUrl:string|null=null;if(attempt.delivery_method==="pdf"&&snapshot.pdf_path){const{data}=await supabase.storage.from("word-efficiency-pdfs").createSignedUrl(String(snapshot.pdf_path),300);signedPdfUrl=data?.signedUrl??null}
 return <WordWorkspace attemptId={attempt.id} snapshot={snapshot} status={attempt.status} startedAt={attempt.started_at} signedPdfUrl={signedPdfUrl} initialDocument={attempt.document_autosave}/>;
}
