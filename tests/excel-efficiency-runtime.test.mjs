import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const tablesPath=new URL("../supabase/migrations/202608260023_excel_efficiency_module.sql",import.meta.url);
const functionsPath=new URL("../supabase/migrations/202608260024_excel_efficiency_functions.sql",import.meta.url);
const admin="81000000-0000-0000-0000-000000000001",student="82000000-0000-0000-0000-000000000002";

async function database(){
 const db=new PGlite();
 await db.exec(`
create schema auth;
create table auth.state(uid uuid,is_admin boolean);
insert into auth.state values('${admin}',true);
create function auth.uid()returns uuid language sql stable as $$select uid from auth.state limit 1$$;
create role anon;create role authenticated;
create table public.profiles(id uuid primary key,role text,is_active boolean);
insert into public.profiles values('${admin}','admin',true),('${student}','student',true);
create function public.is_aal2_admin()returns boolean language sql stable as $$select is_admin from auth.state limit 1$$;
create function public.is_active_word_efficiency_student()returns boolean language sql stable as $$select exists(select 1 from public.profiles where id=auth.uid()and role='student'and is_active)$$;
`);
 await db.exec(await readFile(tablesPath,"utf8"));
 await db.exec(await readFile(functionsPath,"utf8"));
 return db;
}

const matter={schemaVersion:1,language:"English",rows:5,cols:3,cells:{
 A1:{value:"Item",formula:null,bold:true,italic:false,underline:false,fontColor:null,fillColor:null,border:null,numberFormat:"General",align:"left"},
 B1:{value:10,formula:null,bold:false,italic:false,underline:false,fontColor:null,fillColor:null,border:null,numberFormat:"Number",align:"right"},
 B2:{value:20,formula:null,bold:false,italic:false,underline:false,fontColor:null,fillColor:null,border:null,numberFormat:"Number",align:"right"},
 B3:{value:30,formula:null,bold:false,italic:false,underline:false,fontColor:null,fillColor:null,border:null,numberFormat:"Number",align:"right"}
}};

test("admin can author an Excel Efficiency test with a working matter, questions, and a grading rule",async()=>{
 const db=await database();
 const payload={slug:"excel-basic",title:"Excel Basics",language:"English",description:"",instructions_markdown:"1. Complete the sheet as instructed.",question_count:1,maximum_marks:5,duration_options:[600],passing_marks:2,working_matter_snapshot:matter,questions:[{number:1,instruction:"Enter SUM of B1:B3 into B4",marks:5,section:null,display_order:1,is_visible:true}],publish:true};
 const testId=(await db.query("select public.save_excel_efficiency_test(null,$1::jsonb) id",[JSON.stringify(payload)])).rows[0].id;
 assert.ok(testId);
 const version=(await db.query("select current_version_id id from public.excel_efficiency_tests where id=$1",[testId])).rows[0];
 await db.query("select public.save_excel_efficiency_grading_rules($1,$2::jsonb)",[version.id,JSON.stringify([{questionNumber:1,exactTarget:"cells.B4.value",expectedOperation:"formula:SUM",expectedValue:"60",allocatedMarks:5,partialMarks:2}])]);
 await db.exec(`update auth.state set uid='${student}',is_admin=false`);
 const attemptId=(await db.query("select public.prepare_excel_efficiency_attempt($1,600,true) id",[testId])).rows[0].id;
 assert.ok(attemptId);
 const prepared=(await db.query("select original_document_snapshot doc from public.excel_efficiency_attempts where id=$1",[attemptId])).rows[0].doc;
 assert.equal(prepared.cells.A1.value,"Item");
 const edited={...structuredClone(prepared),cells:{...prepared.cells,B4:{value:60,formula:"=SUM(B1:B3)",bold:false,italic:false,underline:false,fontColor:null,fillColor:null,border:null,numberFormat:"Number",align:"right"}},operations:["formula:SUM"]};
 await db.query("select public.autosave_excel_efficiency_document($1,$2::jsonb)",[attemptId,JSON.stringify(edited)]);
 await db.query("select public.submit_excel_efficiency_document($1,$2::jsonb)",[attemptId,JSON.stringify(edited)]);
 const score=(await db.query("select awarded_marks,grading_status,graded_by from public.excel_efficiency_question_scores where attempt_id=$1",[attemptId])).rows[0];
 assert.equal(Number(score.awarded_marks),5);
 assert.equal(score.grading_status,"graded");
 assert.equal(score.graded_by,null);
 await db.exec(`update auth.state set uid='${admin}',is_admin=true`);
 await db.query("select public.save_excel_efficiency_grading($1,$2::jsonb,true)",[attemptId,JSON.stringify({scores:[{questionId:(await db.query("select question_id id from public.excel_efficiency_question_scores where attempt_id=$1",[attemptId])).rows[0].id,awardedMarks:5,feedback:"Correct"}],overallFeedback:"Well done",privateNote:""})]);
 await db.exec(`update auth.state set uid='${student}',is_admin=false`);
 const result=(await db.query("select public.get_excel_efficiency_attempt_result($1) result",[attemptId])).rows[0].result;
 assert.equal(result.status,"published");
 assert.equal(Number(result.marksObtained),5);
 assert.equal(result.questions[0].awardedMarks,5);
 await db.close();
});

test("a mismatched submission earns zero for a graded question and rejects malformed cells",async()=>{
 const db=await database();
 const payload={slug:"excel-basic-2",title:"Excel Basics 2",language:"English",description:"",instructions_markdown:"1. Complete the sheet.",question_count:1,maximum_marks:5,duration_options:[600],passing_marks:null,working_matter_snapshot:matter,questions:[{number:1,instruction:"Enter SUM of B1:B3 into B4",marks:5,section:null,display_order:1,is_visible:true}],publish:true};
 const testId=(await db.query("select public.save_excel_efficiency_test(null,$1::jsonb) id",[JSON.stringify(payload)])).rows[0].id;
 const version=(await db.query("select current_version_id id from public.excel_efficiency_tests where id=$1",[testId])).rows[0];
 await db.query("select public.save_excel_efficiency_grading_rules($1,$2::jsonb)",[version.id,JSON.stringify([{questionNumber:1,exactTarget:"cells.B4.value",expectedOperation:"formula:SUM",expectedValue:"60",allocatedMarks:5,partialMarks:2}])]);
 await db.exec(`update auth.state set uid='${student}',is_admin=false`);
 const attemptId=(await db.query("select public.prepare_excel_efficiency_attempt($1,600,false) id",[testId])).rows[0].id;
 const prepared=(await db.query("select original_document_snapshot doc from public.excel_efficiency_attempts where id=$1",[attemptId])).rows[0].doc;
 const badCells={...structuredClone(prepared),cells:{...prepared.cells,AAA1:{value:"bad ref",formula:null,bold:false,italic:false,underline:false,fontColor:null,fillColor:null,border:null,numberFormat:"General",align:"left"}}};
 await assert.rejects(db.query("select public.autosave_excel_efficiency_document($1,$2::jsonb)",[attemptId,JSON.stringify(badCells)]));
 const wrong={...structuredClone(prepared),cells:{...prepared.cells,B4:{value:99,formula:null,bold:false,italic:false,underline:false,fontColor:null,fillColor:null,border:null,numberFormat:"Number",align:"right"}},operations:[]};
 await db.query("select public.submit_excel_efficiency_document($1,$2::jsonb)",[attemptId,JSON.stringify(wrong)]);
 const score=(await db.query("select awarded_marks from public.excel_efficiency_question_scores where attempt_id=$1",[attemptId])).rows[0];
 assert.equal(Number(score.awarded_marks),0);
 await db.close();
});
