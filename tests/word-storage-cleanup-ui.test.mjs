import assert from"node:assert/strict";import test from"node:test";import{readFile}from"node:fs/promises";
const read=path=>readFile(new URL(`../${path}`,import.meta.url),"utf8");
const ADMIN="app/admin/word-efficiency-tests/";

test("when the service-role key is missing the retry says so instead of silently failing, for one deleted test and for all",async()=>{
 const actions=await read(ADMIN+"actions.ts");
 assert.match(actions,/const STORAGE_KEY_MISSING="Leftover files cannot be removed because SUPABASE_SERVICE_ROLE_KEY is not set/);
 assert.equal((actions.match(/if\(!createAdminClient\(\)\)redirect\(`\/admin\/word-efficiency-tests\?error=\$\{encodeURIComponent\(STORAGE_KEY_MISSING\)\}`\)/g)||[]).length,2);
 assert.match(actions,/export async function retryAllWordEfficiencyStorageCleanup\(\)/);
});

test("the pending-cleanup banner explains the cause, lists each leftover file with its last error and offers Retry all",async()=>{
 const page=await read(ADMIN+"tests-page.tsx");
 assert.match(page,/const cleanupKeyMissing=!process\.env\.SUPABASE_SERVICE_ROLE_KEY/);
 assert.match(page,/select\("audit_id,status,bucket_id,object_path,last_error,attempt_count"\)/);
 assert.match(page,/Retry all \(\{\(cleanupRows\?\?\[\]\)\.length\} files\)/);
 assert.match(page,/not attempted yet/);
});
