import assert from"node:assert/strict";import test from"node:test";import{readFile}from"node:fs/promises";import{PGlite}from"@electric-sql/pglite";

const migration=new URL("../supabase/migrations/202610141000_carry_model_answer_to_new_version.sql",import.meta.url);
const T="10000000-0000-0000-0000-000000000001",U="10000000-0000-0000-0000-000000000002";
const matter=text=>JSON.stringify({paragraphs:[{type:"paragraph",runs:[{text}]}]});
const answer=text=>JSON.stringify({blocks:[{runs:[{text}]}]});

async function database(){
 const db=new PGlite();
 await db.exec(`create table public.word_efficiency_versions(id uuid primary key default gen_random_uuid(),test_id uuid,version_number int,working_matter_snapshot jsonb,model_answer_snapshot jsonb);
  create table public.word_efficiency_grading_rules(id uuid primary key default gen_random_uuid(),version_id uuid);`);
 return db;
}
const add=(db,test,n,m,a)=>db.query("insert into public.word_efficiency_versions(test_id,version_number,working_matter_snapshot,model_answer_snapshot) values($1,$2,$3::jsonb,$4::jsonb) returning id",[test,n,m,a]).then(r=>r.rows[0].id);
const answerOf=async(db,id)=>(await db.query("select model_answer_snapshot as a from public.word_efficiency_versions where id=$1",[id])).rows[0].a;

test("a new version with the SAME working document inherits the latest Model Answer",async()=>{
 const db=await database();await db.exec(await readFile(migration,"utf8"));
 await add(db,T,1,matter("doc"),answer("solved"));
 const v2=await add(db,T,2,matter("doc"),null);
 assert.equal((await answerOf(db,v2)).blocks[0].runs[0].text,"solved");
 await db.close();
});

test("a version with a CHANGED working document does not inherit (the rules would point at the wrong places)",async()=>{
 const db=await database();await db.exec(await readFile(migration,"utf8"));
 await add(db,T,1,matter("doc"),answer("solved"));
 const v2=await add(db,T,2,matter("a different document"),null);
 assert.equal(await answerOf(db,v2),null);
 await db.close();
});

test("another test's Model Answer is never borrowed, and an explicitly supplied one is kept",async()=>{
 const db=await database();await db.exec(await readFile(migration,"utf8"));
 await add(db,U,1,matter("doc"),answer("other test"));
 const mine=await add(db,T,1,matter("doc"),null);
 assert.equal(await answerOf(db,mine),null);
 await add(db,T,2,matter("doc"),answer("v2 own"));
 const v3=await add(db,T,3,matter("doc"),answer("v3 own"));
 assert.equal((await answerOf(db,v3)).blocks[0].runs[0].text,"v3 own");
 await db.close();
});

test("it takes the most recent Model Answer when several versions have one",async()=>{
 const db=await database();await db.exec(await readFile(migration,"utf8"));
 await add(db,T,1,matter("doc"),answer("old"));await add(db,T,2,matter("doc"),answer("newer"));
 const v3=await add(db,T,3,matter("doc"),null);
 assert.equal((await answerOf(db,v3)).blocks[0].runs[0].text,"newer");
 await db.close();
});

test("the one-time repair fixes an affected version that has rules, and leaves a deliberately reset one (no rules) alone",async()=>{
 const db=await database();
 // state BEFORE the migration: v2 and v3 were saved without a Model Answer
 const v1=await add(db,T,1,matter("doc"),answer("solved"));
 const v2=await add(db,T,2,matter("doc"),null);const v3=await add(db,T,3,matter("doc"),null);
 await db.query("insert into public.word_efficiency_grading_rules(version_id) values($1)",[v2]);
 void v1;void v3;
 await db.exec(await readFile(migration,"utf8"));
 assert.equal((await answerOf(db,v2)).blocks[0].runs[0].text,"solved","repaired");
 assert.equal(await answerOf(db,v3),null,"no rules: it was reset on purpose, so it stays empty");
 await db.close();
});

test("the migration is transactional and has balanced dollar quotes",async()=>{
 const sql=await readFile(migration,"utf8");
 assert.match(sql,/^begin;/);assert.match(sql,/commit;\s*$/);
 assert.equal((sql.match(/\$\$/g)||[]).length%2,0);
});
