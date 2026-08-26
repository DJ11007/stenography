import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const migrationPath=new URL("../supabase/migrations/202608260026_student_phone_and_profile_admin.sql",import.meta.url);

async function database(){
 const db=new PGlite();
 await db.exec(`
create role anon;create role authenticated;
create type app_role as enum('student','admin');
create table public.profiles(
 id uuid primary key,
 email text not null,
 full_name text,
 role app_role not null default 'student',
 is_active boolean not null default true,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create schema auth;
create table auth.users(
 id uuid primary key,
 email text,
 raw_user_meta_data jsonb
);
`);
 await db.exec(await readFile(migrationPath,"utf8"));
 return db;
}

test("handle_new_user captures an optional phone from signup metadata alongside the existing full_name",async()=>{
 const db=await database();
 const withPhone="00000000-0000-4000-8000-000000000001",withoutPhone="00000000-0000-4000-8000-000000000002";
 // handle_new_user is a trigger function, so it must be exercised through a real trigger.
 await db.exec("create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();");
 await db.query("insert into auth.users(id,email,raw_user_meta_data)values($1,$2,$3::jsonb)",[withPhone,"WithPhone@Example.com",{full_name:"With Phone",phone:"+919812345678"}]);
 await db.query("insert into auth.users(id,email,raw_user_meta_data)values($1,$2,$3::jsonb)",[withoutPhone,"NoPhone@Example.com",{full_name:"No Phone"}]);
 const{rows}=await db.query("select id,email,full_name,phone from public.profiles where id=$1",[withoutPhone]);
 assert.equal(rows.length,1);assert.equal(rows[0].email,"nophone@example.com");assert.equal(rows[0].full_name,"No Phone");assert.equal(rows[0].phone,null);
 await db.close();
});

test("handle_new_user stores a provided phone number and blank phone stays null",async()=>{
 const db=await database();
 await db.exec("create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();");
 const withPhone="00000000-0000-4000-8000-000000000003",blankPhone="00000000-0000-4000-8000-000000000004";
 await db.query("insert into auth.users(id,email,raw_user_meta_data)values($1,$2,$3::jsonb)",[withPhone,"phoned@example.com",{full_name:"Has Phone",phone:"+919812345678"}]);
 await db.query("insert into auth.users(id,email,raw_user_meta_data)values($1,$2,$3::jsonb)",[blankPhone,"blank@example.com",{full_name:"Blank Phone",phone:"   "}]);
 const{rows}=await db.query("select id,phone from public.profiles where id in($1,$2)order by id",[withPhone,blankPhone]);
 assert.equal(rows[0].phone,"+919812345678");assert.equal(rows[1].phone,null);
 await db.close();
});
