import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { decideSignInDestination, safeAuthenticatedNext } from "../lib/auth-routing.ts";
import { expireSupabaseAuthTokenCookies,isMissingRefreshTokenError,isSupabaseAuthTokenCookie,refreshSupabaseSession } from "../lib/supabase-refresh-session.ts";

test("an invalid application role is denied on the admin login surface", () => {
  assert.deepEqual(decideSignInDestination("admin", null, null), { type: "deny-admin" });
  assert.deepEqual(decideSignInDestination("admin", "student", "aal1"), { type: "deny-admin" });
});

test("an AAL2 administrator enters the admin panel", () => {
  assert.deepEqual(decideSignInDestination("admin", "admin", "aal2"), {
    type: "redirect",
    destination: "/admin",
  });
});

test("an AAL1 administrator is sent to the reachable MFA path", () => {
  assert.deepEqual(decideSignInDestination("admin", "admin", "aal1"), {
    type: "redirect",
    destination: "/account/security?next=/admin",
  });
});

test("a student login opens the protected Typing Hub", () => {
  assert.deepEqual(decideSignInDestination("student", "student", "aal1"), {
    type: "redirect",
    destination: "/typing",
  });
});

test("account-security next paths are allowlisted", () => {
  assert.equal(safeAuthenticatedNext("/admin"), "/admin");
  assert.equal(safeAuthenticatedNext("https://evil.example"), undefined);
  assert.equal(safeAuthenticatedNext("//evil.example"), undefined);
});

test("login reuses the signed-in user and public login routes skip proxy session lookup", () => {
  const actions = readFileSync(new URL("../app/auth/actions.ts", import.meta.url), "utf8");
  const proxy = readFileSync(new URL("../proxy.ts", import.meta.url), "utf8");
  assert.match(actions, /const user = signInData\.user/);
  assert.doesNotMatch(actions, /signInWithPassword[\s\S]{0,300}auth\.getUser/);
  assert.match(proxy, /login\(\?:\/\|\$\)/);
  assert.match(proxy, /admin\/login\(\?:\/\|\$\)/);
});

test("returned refresh-token-not-found errors clear the invalid session",async()=>{
 let clears=0;await refreshSupabaseSession(async()=>({error:{status:400,code:"refresh_token_not_found",message:"Invalid Refresh Token: Refresh Token Not Found"}}),()=>{clears++});assert.equal(clears,1);
});

test("thrown refresh-token-not-found errors clear the invalid session",async()=>{
 let clears=0;await refreshSupabaseSession(async()=>{throw{status:400,code:"refresh_token_not_found",message:"Invalid Refresh Token: Refresh Token Not Found"}},()=>{clears++});assert.equal(clears,1);
});

test("temporary Supabase failures remain non-fatal and preserve the session",async()=>{
 let clears=0;await refreshSupabaseSession(async()=>{throw new Error("fetch failed")},()=>{clears++});await refreshSupabaseSession(async()=>({error:{status:503,code:"service_unavailable",message:"Supabase temporarily unavailable"}}),()=>{clears++});assert.equal(clears,0);assert.equal(isMissingRefreshTokenError(new Error("fetch failed")),false);
});

test("refresh-token cleanup removes base and chunked auth cookies from request and response only",()=>{
 const incoming=new Map([["sb-project-ref-auth-token","base"],["sb-project-ref-auth-token.0","chunk-0"],["sb-project-ref-auth-token.1","chunk-1"],["sb-project-ref-auth-token-code-verifier","verifier"],["theme","dark"],["analytics_id","123"]]);const expired=[];
 const requestCookies={getAll:()=>[...incoming].map(([name])=>({name})),delete:name=>incoming.delete(name)};const responseCookies={set:cookie=>expired.push(cookie)};
 expireSupabaseAuthTokenCookies(requestCookies,responseCookies);
 assert.deepEqual([...incoming.keys()],["sb-project-ref-auth-token-code-verifier","theme","analytics_id"]);assert.deepEqual(expired.map(cookie=>cookie.name),["sb-project-ref-auth-token","sb-project-ref-auth-token.0","sb-project-ref-auth-token.1"]);assert.ok(expired.every(cookie=>cookie.value===""&&cookie.path==="/"&&cookie.maxAge===0));assert.equal(isSupabaseAuthTokenCookie("sb-project-ref-auth-token.12"),true);assert.equal(isSupabaseAuthTokenCookie("theme"),false);
});

test("proxy applies invalid-session cleanup to both incoming and outgoing cookie state",()=>{
 const proxy=readFileSync(new URL("../proxy.ts",import.meta.url),"utf8");assert.match(proxy,/refreshSupabaseSession/);assert.match(proxy,/expireSupabaseAuthTokenCookies\(request\.cookies,response\.cookies\)/);
});
