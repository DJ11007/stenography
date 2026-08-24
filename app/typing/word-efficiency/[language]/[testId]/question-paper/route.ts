import{NextResponse}from"next/server";
import{requireStudent}from"@/lib/auth";
import{createClient}from"@/lib/supabase/server";

export async function GET(_:Request,{params}:{params:Promise<{language:string;testId:string}>}){
 await requireStudent();const{language,testId}=await params;const wordLanguage=language==="hindi"?"Hindi":language==="english"?"English":null;if(!wordLanguage)return new NextResponse("Not found",{status:404});const supabase=await createClient();const{data:test}=await supabase.from("word_efficiency_tests").select("current_version_id").eq("id",testId).eq("language",wordLanguage).eq("status","published").maybeSingle();if(!test?.current_version_id)return new NextResponse("Not found",{status:404});const{data:version}=await supabase.from("word_efficiency_versions").select("pdf_path,pdf_file_name,delivery_pdf").eq("id",test.current_version_id).eq("test_id",testId).maybeSingle();if(!version?.delivery_pdf||!version.pdf_path)return new NextResponse("Question paper unavailable",{status:404});const{data,error}=await supabase.storage.from("word-efficiency-pdfs").createSignedUrl(version.pdf_path,60,{download:version.pdf_file_name??"question-paper.pdf"});if(error||!data?.signedUrl)return new NextResponse("Question paper download failed. Please retry.",{status:503});return NextResponse.redirect(data.signedUrl)
}
