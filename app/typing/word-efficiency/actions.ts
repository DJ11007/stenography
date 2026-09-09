"use server";
import { redirect } from "next/navigation";
import { requireStudent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import{validateWordEditorDocument}from"@/lib/word-editor-document";
import{convertWorkingMatterToEditorDocument,parseWorkingMatterDocx,validateWorkingMatterFile}from"@/lib/word-docx";
import{safePdfName}from"@/lib/word-efficiency";

export async function prepareWordAttempt(form:FormData){await requireStudent();if(form.get("accepted")!=="on")return;const testId=String(form.get("testId")??"");const duration=Number(form.get("duration"));const language=String(form.get("language")==="hindi"?"hindi":"english");const supabase=await createClient();const{data:test}=await supabase.from("word_efficiency_tests").select("current_version_id").eq("id",testId).eq("status","published").maybeSingle();const{data:version}=test?.current_version_id?await supabase.from("word_efficiency_versions").select("id,delivery_onscreen,delivery_pdf,delivery_realfile,pdf_path").eq("id",test.current_version_id).maybeSingle():{data:null};if(!version)redirect(`/typing/word-efficiency/${language}/${testId}/instructions?duration=${duration}&error=Test%20version%20unavailable`);const delivery=version.delivery_realfile?"realfile":version.delivery_onscreen?"onscreen":"pdf";if(delivery==="pdf"&&(!version.pdf_path||form.get("pdfAcknowledged")!==version.id))redirect(`/typing/word-efficiency/${language}/${testId}/instructions?duration=${duration}&error=Download%20the%20question%20paper%20before%20starting`);const{data,error}=await supabase.rpc("prepare_word_efficiency_attempt",{p_test_id:testId,p_duration_seconds:duration,p_delivery:delivery});if(error||!data)redirect(`/typing/word-efficiency/${language}/${testId}/instructions?duration=${duration}&error=${encodeURIComponent(error?.message??"Unable to prepare attempt")}`);const{error:documentError}=await supabase.rpc("initialize_word_efficiency_document",{p_attempt_id:data,p_show_questions:form.get("showQuestions")==="on"});if(documentError)redirect(`/typing/word-efficiency/${language}/${testId}/instructions?duration=${duration}&error=${encodeURIComponent(documentError.message)}`);const{error:startError}=await supabase.rpc("start_word_efficiency_attempt",{p_attempt_id:data});if(startError)redirect(`/typing/word-efficiency/${language}/${testId}/instructions?duration=${duration}&error=${encodeURIComponent("The attempt could not be started.")}`);redirect(`/typing/word-efficiency/${language}/${testId}/${delivery==="realfile"?"realfile":"workspace"}?attempt=${data}`)}

// The uploaded file is untrusted student input (unlike an admin's Working
// Matter upload), so it goes through the exact same hardened DOCX parser
// (path traversal/zip-bomb/macro/external-relationship rejection) before
// anything else touches it. Converting to the same document shape the
// on-screen editor produces means submit_word_efficiency_document's
// existing auto-grading, results, and admin review all work completely
// unchanged -- nothing downstream needed to know this document came from a
// real uploaded file instead of live typing.
export async function submitWordEfficiencyRealFile(attemptId:string,form:FormData):Promise<{ok:boolean;error:string}>{
 const upload=form.get("file");
 if(!(upload instanceof File)||!upload.size)return{ok:false,error:"Choose your finished .docx file before submitting."};
 const validationErrors=validateWorkingMatterFile(upload);
 if(validationErrors.length)return{ok:false,error:validationErrors[0]};
 const bytes=new Uint8Array(await upload.arrayBuffer());
 let document:Record<string,unknown>;
 try{
  const matter=parseWorkingMatterDocx(bytes);
  document=convertWorkingMatterToEditorDocument(matter);
 }catch(error){
  return{ok:false,error:error instanceof Error?`Your file could not be read: ${error.message}`:"Your file could not be read."};
 }
 let safeDocument:unknown;
 try{safeDocument=validateWordEditorDocument(document)}
 catch{return{ok:false,error:"Your document could not be converted safely. Please check the file and try again."}}
 const supabase=await createClient();
 const fileName=safePdfName(upload.name);
 await supabase.storage.from("word-efficiency-submissions").upload(`${attemptId}/${fileName}`,bytes,{contentType:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",upsert:true});
 const{error}=await supabase.rpc("submit_word_efficiency_document",{p_attempt_id:attemptId,p_document:safeDocument});
 if(error){if(process.env.NODE_ENV==="development")console.error("[Word Efficiency real-file submission RPC failed]",{message:error.message,code:error.code,details:error.details,hint:error.hint});return{ok:false,error:submissionError(error)}}
 return{ok:true,error:""};
}
export async function startWordAttempt(attemptId:string){await requireStudent();const supabase=await createClient();const {data,error}=await supabase.rpc("start_word_efficiency_attempt",{p_attempt_id:attemptId});if(error)throw new Error("The attempt could not be started.");return String(data)}
// autosaveWordDocument/submitWordDocument deliberately do NOT call requireStudent() -- these
// fire on every debounced keystroke during a live attempt, and requireStudent() does two extra
// network round trips (a live auth.getUser() revalidation, then a profiles lookup) purely to
// redirect("/login") if either fails. Under load, a transient hiccup in either call was enough
// to bounce a mid-exam student straight to the sign-in page -- a false "logout", not a real one --
// while also adding real latency to every single autosave. Ownership and role are already
// enforced inside the RPC itself (student_id=auth.uid(), is_active_word_efficiency_student()),
// which returns a normal {ok:false} error instead of redirecting when something is wrong.
// Speed fix, reported live (deployed site): submitting/autosaving a Word
// Efficiency document spent a whole extra Supabase round trip here --
// select("snapshot") from word_efficiency_attempts, purely to read
// editor_capabilities so validateWordEditorOperations() could pre-check
// the document's operations log client-side -- before ever calling the
// actual autosave/submit RPC. That pre-check is fully redundant: both
// autosave_word_efficiency_document and submit_word_efficiency_document
// already call assert_word_efficiency_capability_changes() themselves
// (see supabase/migrations/202608240008_repair_word_efficiency_
// submission_baseline.sql), which re-derives effective_capabilities from
// word_efficiency_versions and checks the exact same operations array --
// a strict superset of what validateWordEditorOperations did, since it
// also diffs the document's actual features against the baseline, not
// just the self-reported operations log. A student never saw a more
// specific error for this either way: submissionError() only surfaces
// RPC-message detail in development, production always showed the same
// generic "Autosave/Submission failed." string regardless of which check
// failed. Dropping this call halves the round trips on every autosave
// (fires on every ~800ms-debounced edit -- see rich-document-editor.tsx's
// changed()) and removes one full round trip from the final submit,
// exactly the class of fix already applied to typing test submission
// (recordManagedAttempt, five round trips to three) and reported the
// same way: a student staring at a frozen/blank screen while this
// resolved, worse whenever Supabase's own auth/API latency spikes.
export async function autosaveWordDocument(attemptId:string,document:unknown):Promise<{ok:boolean;error:string}>{const safeDocument=validateWordEditorDocument(document);const supabase=await createClient();const{error}=await supabase.rpc("autosave_word_efficiency_document",{p_attempt_id:attemptId,p_document:safeDocument});if(error)return{ok:false,error:process.env.NODE_ENV==="development"?`Autosave failed: ${error.message}`:"Autosave failed."};return{ok:true,error:""}}
export async function submitWordDocument(attemptId:string,document:unknown):Promise<{ok:boolean;error:string}>{try{const safeDocument=validateWordEditorDocument(document);const supabase=await createClient();const{error}=await supabase.rpc("submit_word_efficiency_document",{p_attempt_id:attemptId,p_document:safeDocument});if(error){if(process.env.NODE_ENV==="development")console.error("[Word Efficiency submission RPC failed]",{message:error.message,code:error.code,details:error.details,hint:error.hint});return{ok:false,error:submissionError(error)}}return{ok:true,error:""}}catch(error){return{ok:false,error:submissionError(error)}}}

function submissionError(error:unknown){if(process.env.NODE_ENV!=="development")return"Submission failed.";const candidate=error as{message?:unknown;code?:unknown;details?:unknown;hint?:unknown};const fields=[`message=${String(candidate?.message??"unknown submission error")}`];if(candidate?.code)fields.push(`code=${String(candidate.code)}`);if(candidate?.details)fields.push(`details=${String(candidate.details)}`);if(candidate?.hint)fields.push(`hint=${String(candidate.hint)}`);return`Submission failed: ${fields.join(" · ")}`}
