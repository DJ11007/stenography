import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStudent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PrintResultButton } from "./print-result-button";
import { BackButton } from "../../../../_components/back-button";
import { QuestionContent } from "@/components/efficiency/question-content";

export const metadata:Metadata={title:"Word Efficiency Result | Samradhi Classes"};
type ResultQuestion={number:number;instruction:string|null;section:string|null;maximumMarks:number;awardedMarks:number|null;feedback:string|null;gradingStatus:string};
type AttemptResult={title:string;language:string;status:"pending"|"published";submittedAt:string|null;evaluatedAt:string|null;maximumMarks:number;marksObtained:number|null;percentage:number|null;passingMarks:number|null;passed:boolean|null;overallFeedback:string|null;questions:ResultQuestion[]};

export default async function WordEfficiencyResultPage({params}:{params:Promise<{attemptId:string}>}){
 await requireStudent();const{attemptId}=await params;const supabase=await createClient();const{data,error}=await supabase.rpc("get_word_efficiency_attempt_result",{p_attempt_id:attemptId});if(error||!data)notFound();const result=data as AttemptResult;const catalogue=`/typing/word-efficiency/${result.language.toLowerCase()==="hindi"?"hindi":"english"}`;
 return <main className="min-h-screen bg-slate-100 px-4 py-10 print:bg-white print:p-0"><section className="mx-auto max-w-5xl overflow-hidden rounded-3xl bg-white shadow-xl print:max-w-none print:rounded-none print:shadow-none"><header className="bg-gradient-to-r from-slate-950 to-blue-900 p-7 text-white print:bg-white print:p-0 print:text-black"><BackButton href={catalogue} label="Test catalogue" dark className="print:hidden"/><p className="mt-3 text-xs font-black uppercase tracking-[.2em] text-cyan-300 print:text-slate-600">Word Efficiency evaluation</p><h1 className="mt-2 text-3xl font-black">{result.status==="published"?"Test result":"Test submitted successfully"}</h1><p className="mt-2 text-slate-300 print:text-slate-700">{result.title}</p></header><div className="p-6 sm:p-8 print:p-0 print:pt-5"><Published result={result} catalogue={catalogue}/></div></section></main>;
}

function Published({result,catalogue}:{result:AttemptResult;catalogue:string}){
 const groups=groupBySection(result.questions);const sectioned=groups.length>1||groups[0]?.section!=null;
 const grandMaxTotal=result.questions.reduce((sum,q)=>sum+q.maximumMarks,0);
 const allGraded=result.questions.every(q=>q.awardedMarks!=null);
 const grandAwardedTotal=allGraded?result.questions.reduce((sum,q)=>sum+(q.awardedMarks??0),0):null;
 return <div>
  {result.status!=="published"&&<p role="status" className="mb-5 rounded-xl bg-amber-50 p-4 text-sm font-bold text-amber-900">Submitted — evaluation pending. Your document is safely submitted and cannot be edited again. Marks below show "Not graded" until your teacher publishes the evaluation.</p>}
  <h2 className="text-center text-xl font-black uppercase tracking-wide text-slate-500">Result Summary</h2>
  <table className="mx-auto mt-4 w-full max-w-md border-collapse overflow-hidden rounded-xl border text-sm shadow-sm"><tbody>
   <tr className="border-b"><td className="bg-slate-50 p-3 font-bold">Maximum Marks</td><td className="p-3 font-black">{result.maximumMarks}</td></tr>
   <tr className="border-b"><td className="bg-slate-50 p-3 font-bold">Marks Obtained</td><td className="p-3 font-black">{result.marksObtained==null?"Not graded":result.marksObtained}</td></tr>
   <tr><td className="bg-slate-50 p-3 font-bold">Your Score</td><td className="p-3 font-black">{result.percentage==null?"Not graded":`${result.percentage}%`}</td></tr>
  </tbody></table>
  {result.percentage!=null&&<div className="mx-auto mt-5 max-w-md"><div className="h-3 w-full overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-blue-700" style={{width:`${Math.max(0,Math.min(100,result.percentage))}%`}}/></div></div>}
  <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Metric label="Result" value={result.status!=="published"?"Pending":result.passingMarks==null?"No pass mark configured":result.passed?"Pass":"Fail"}/><Metric label="Evaluation status" value={result.status==="published"?"Published":"Pending"}/><Metric label="Submitted" value={date(result.submittedAt)}/><Metric label="Evaluated" value={date(result.evaluatedAt)}/></div>
  {result.overallFeedback&&<section className="mt-6 rounded-2xl bg-blue-50 p-5"><h2 className="font-black">Teacher feedback</h2><p className="mt-2 whitespace-pre-wrap text-slate-700">{result.overallFeedback}</p></section>}
  <h2 className="mt-8 text-center text-xl font-black uppercase tracking-wide text-slate-500">Detailed Result</h2>
  <div className="mt-4 overflow-x-auto"><table className="w-full border-collapse text-left text-sm"><thead><tr className="bg-slate-100"><th className="p-3">S.No.</th><th className="p-3">Question instruction</th><th className="p-3">Maximum marks</th><th className="p-3">Marks obtained</th><th className="p-3">Teacher feedback</th></tr></thead><tbody>{groups.map((group,index)=><SectionRows key={index} group={group} sectioned={sectioned}/>)}<tr className="border-t-2 border-slate-400 bg-slate-100 font-black"><td className="p-3" colSpan={2}>Grand Total</td><td className="p-3">{grandMaxTotal}</td><td className="p-3">{grandAwardedTotal==null?"Not graded":grandAwardedTotal}</td><td className="p-3"/></tr></tbody></table></div>
  <div className="mt-7 flex flex-wrap gap-3"><PrintResultButton/><Link href={catalogue} className="print:hidden rounded-xl bg-blue-700 px-5 py-3 font-black text-white">Return to test catalogue</Link></div>
 </div>;
}
function groupBySection(questions:ResultQuestion[]){const groups:{section:string|null;questions:ResultQuestion[]}[]=[];for(const question of questions){const last=groups.at(-1);if(last&&last.section===(question.section??null))last.questions.push(question);else groups.push({section:question.section??null,questions:[question]})}return groups}
function SectionRows({group,sectioned}:{group:{section:string|null;questions:ResultQuestion[]};sectioned:boolean}){const maxTotal=group.questions.reduce((sum,q)=>sum+q.maximumMarks,0);const graded=group.questions.every(q=>q.awardedMarks!=null);const awardedTotal=graded?group.questions.reduce((sum,q)=>sum+(q.awardedMarks??0),0):null;return <>{sectioned&&group.section&&<tr className="bg-slate-50"><td colSpan={5} className="p-2 text-xs font-black uppercase tracking-wide text-slate-500">{group.section}</td></tr>}{group.questions.map(question=><tr key={question.number} className="border-b align-top"><td className="p-3 font-black">{question.number}</td><td className="p-3"><QuestionContent text={question.instruction}/></td><td className="p-3">{question.maximumMarks}</td><td className="p-3 font-black">{question.awardedMarks==null?"Not graded":question.awardedMarks}</td><td className="p-3 whitespace-pre-wrap text-slate-600">{question.feedback||"—"}</td></tr>)}{sectioned&&group.section&&<tr className="border-b bg-slate-50 font-black"><td className="p-3" colSpan={2}>Section subtotal</td><td className="p-3">{maxTotal}</td><td className="p-3">{awardedTotal==null?"Not graded":awardedTotal}</td><td className="p-3"/></tr>}</>}
function Metric({label,value}:{label:string;value:string}){return <div className="rounded-xl border bg-slate-50 p-4"><dt className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 font-black text-slate-950">{value}</dd></div>}
function date(value:string|null){return value?new Intl.DateTimeFormat("en-IN",{dateStyle:"medium",timeStyle:"short",timeZone:"Asia/Kolkata"}).format(new Date(value)):"Unavailable"}
