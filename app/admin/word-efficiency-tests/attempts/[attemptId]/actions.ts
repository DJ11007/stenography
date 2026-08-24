"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function saveWordEfficiencyGrading(formData:FormData){
 await requireAdmin();const attemptId=String(formData.get("attemptId")??"");const publish=formData.get("intent")==="publish";let questionIds:string[]=[];try{questionIds=JSON.parse(String(formData.get("questionIds")??"[]"))}catch{}
 const scores=questionIds.map(questionId=>{const raw=String(formData.get(`marks:${questionId}`)??"").trim();return{questionId,awardedMarks:raw===""?null:Number(raw),feedback:String(formData.get(`feedback:${questionId}`)??"").trim(),privateNote:""}});
 const payload={scores,overallFeedback:String(formData.get("overallFeedback")??"").trim(),privateNote:String(formData.get("privateNote")??"").trim()};const supabase=await createClient();const{error}=await supabase.rpc("save_word_efficiency_grading",{p_attempt_id:attemptId,p_payload:payload,p_publish:publish});if(error)redirect(`/admin/word-efficiency-tests/attempts/${attemptId}?error=${encodeURIComponent(error.message)}`);revalidatePath(`/admin/word-efficiency-tests/attempts/${attemptId}`);revalidatePath(`/typing/word-efficiency/results/${attemptId}`);redirect(`/admin/word-efficiency-tests/attempts/${attemptId}?${publish?"published":"saved"}=1`)
}
