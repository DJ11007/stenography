import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const migrationPath=new URL("../supabase/migrations/202608250017_word_efficiency_automatic_grading.sql",import.meta.url);
const student="21000000-0000-0000-0000-000000000002",testId="41000000-0000-0000-0000-000000000004",version="51000000-0000-0000-0000-000000000005",ruledQuestion="71000000-0000-0000-0000-000000000007",manualQuestion="72000000-0000-0000-0000-000000000008";

function attemptRow(id,startedAt){return`insert into public.word_efficiency_attempts(id,test_id,version_id,student_id,status,selected_duration_seconds,started_at,snapshot,original_document_snapshot)values('${id}','${testId}','${version}','${student}','active',600,'${startedAt}'::timestamptz,'{}'::jsonb,'{"schemaVersion":"1","blocks":[{"id":"block-1","type":"paragraph","alignment":"left","runs":[{"text":"Hello"}]}],"savedAt":"1970-01-01T00:00:00.000Z"}'::jsonb);`}
function scoreRows(attemptId){return`insert into public.word_efficiency_question_scores(attempt_id,question_id,question_number,maximum_marks,grading_status)values('${attemptId}','${ruledQuestion}',1,3,'ungraded'),('${attemptId}','${manualQuestion}',2,5,'ungraded');`}

async function database(){
 const db=new PGlite();
 await db.exec(`
create schema auth;
create table auth.state(uid uuid);
insert into auth.state values('${student}');
create function auth.uid()returns uuid language sql stable as $$select uid from auth.state limit 1$$;
create role anon;create role authenticated;
create table public.profiles(id uuid primary key,role text,is_active boolean);
insert into public.profiles values('${student}','student',true);
create function public.is_active_word_efficiency_student()returns boolean language sql stable as $$select exists(select 1 from public.profiles where id=auth.uid()and role='student'and is_active)$$;
create function public.normalize_word_efficiency_editor_capabilities(c jsonb)returns jsonb language sql immutable as $$select coalesce(c,'{}'::jsonb)$$;
create function public.assert_word_efficiency_editor_capabilities(c jsonb)returns void language plpgsql immutable as $$begin end $$;
create function public.word_efficiency_initial_editor_document(m jsonb)returns jsonb language sql immutable as $$select m$$;
create function public.assert_word_efficiency_document_schema(d jsonb,caps jsonb)returns void language plpgsql immutable as $$begin end $$;
create function public.assert_word_efficiency_capability_changes(d jsonb,baseline jsonb,caps jsonb)returns void language plpgsql immutable as $$begin end $$;
create table public.word_efficiency_tests(id uuid primary key);
create table public.word_efficiency_versions(id uuid primary key,test_id uuid,title text,language text,maximum_marks numeric,passing_marks numeric,editor_capabilities jsonb);
create table public.word_efficiency_questions(id uuid primary key,version_id uuid,instruction text,display_order int);
create table public.word_efficiency_attempts(id uuid primary key,test_id uuid,version_id uuid,student_id uuid,status text,selected_duration_seconds int,started_at timestamptz,snapshot jsonb,result jsonb,submitted_at timestamptz,updated_at timestamptz,original_document_snapshot jsonb,final_document_snapshot jsonb,document_autosave jsonb);
create table public.word_efficiency_question_scores(id uuid primary key default gen_random_uuid(),attempt_id uuid,question_id uuid,question_number int,maximum_marks numeric,awarded_marks numeric,teacher_comment text,grading_status text,grading_note_snapshot text,graded_by uuid,graded_at timestamptz,created_at timestamptz default now(),updated_at timestamptz default now());
create table public.word_efficiency_grading_rules(id uuid primary key default gen_random_uuid(),version_id uuid,question_id uuid,exact_target text,expected_operation text,expected_value jsonb,allocated_marks numeric,partial_marks numeric);
insert into public.word_efficiency_tests values('${testId}');
insert into public.word_efficiency_versions values('${version}','${testId}','Practice Test','English',8,4,'{}'::jsonb);
insert into public.word_efficiency_questions values('${ruledQuestion}','${version}','Bold the first word',1),('${manualQuestion}','${version}','Write a summary',2);
insert into public.word_efficiency_grading_rules(version_id,question_id,exact_target,expected_operation,expected_value,allocated_marks,partial_marks)values('${version}','${ruledQuestion}','blocks.block-1.runs.0.bold','bold','true'::jsonb,3,1);
`);
 await db.exec(await readFile(migrationPath,"utf8"));
 return db;
}

test("an exact rule match auto-awards full marks at submission and leaves the unrelated question untouched",async()=>{
 const db=await database();
 const attempt="61000000-0000-0000-0000-000000000006";
 await db.exec(attemptRow(attempt,new Date().toISOString()));
 await db.exec(scoreRows(attempt));
 const document={schemaVersion:"2",blocks:[{id:"block-1",type:"paragraph",alignment:"left",runs:[{text:"Hello",bold:true}]}],pageLayout:{},operations:["bold"],savedAt:new Date().toISOString()};
 await db.query("select public.submit_word_efficiency_document($1,$2::jsonb)",[attempt,JSON.stringify(document)]);
 const rows=(await db.query("select question_id,awarded_marks,grading_status,graded_by from public.word_efficiency_question_scores where attempt_id=$1 order by question_number",[attempt])).rows;
 assert.equal(Number(rows[0].awarded_marks),3);
 assert.equal(rows[0].grading_status,"graded");
 assert.equal(rows[0].graded_by,null);
 assert.equal(rows[1].awarded_marks,null);
 assert.equal(rows[1].grading_status,"ungraded");
 const attemptRowResult=(await db.query("select status,final_document_snapshot from public.word_efficiency_attempts where id=$1",[attempt])).rows[0];
 assert.equal(attemptRowResult.status,"submitted");
 await db.close();
});

test("an operation-only near miss awards configured partial marks instead of full marks",async()=>{
 const db=await database();
 const attempt="62000000-0000-0000-0000-000000000006";
 await db.exec(attemptRow(attempt,new Date().toISOString()));
 await db.exec(scoreRows(attempt));
 const document={schemaVersion:"2",blocks:[{id:"block-1",type:"paragraph",alignment:"left",runs:[{text:"Hello",bold:false}]}],pageLayout:{},operations:["bold"],savedAt:new Date().toISOString()};
 await db.query("select public.submit_word_efficiency_document($1,$2::jsonb)",[attempt,JSON.stringify(document)]);
 const row=(await db.query("select awarded_marks from public.word_efficiency_question_scores where attempt_id=$1 and question_id=$2",[attempt,ruledQuestion])).rows[0];
 assert.equal(Number(row.awarded_marks),1);
 await db.close();
});

test("no match and no relevant operation awards zero, and a question with no authored rule always stays manual",async()=>{
 const db=await database();
 const attempt="63000000-0000-0000-0000-000000000006";
 await db.exec(attemptRow(attempt,new Date().toISOString()));
 await db.exec(scoreRows(attempt));
 const document={schemaVersion:"2",blocks:[{id:"block-1",type:"paragraph",alignment:"left",runs:[{text:"Hello",bold:false}]}],pageLayout:{},operations:[],savedAt:new Date().toISOString()};
 await db.query("select public.submit_word_efficiency_document($1,$2::jsonb)",[attempt,JSON.stringify(document)]);
 const rows=(await db.query("select question_id,awarded_marks from public.word_efficiency_question_scores where attempt_id=$1 order by question_number",[attempt])).rows;
 assert.equal(Number(rows[0].awarded_marks),0);
 assert.equal(rows[1].awarded_marks,null);
 await db.close();
});
