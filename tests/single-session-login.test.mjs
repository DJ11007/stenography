import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

// A student signing in logs out every other device at once: no "already signed in" warning,
// no checkbox, no second sign-in.
test("student sign-in revokes other sessions directly, without asking", async () => {
  const actions = await read("app/auth/actions.ts");
  const form = await read("app/login/login-form.tsx");
  assert.match(actions, /if \(role === "student"\) \{\s*const \{ error: othersError \} = await supabase\.auth\.signOut\(\{ scope: "others" \}\);/);
  assert.doesNotMatch(actions, /already signed in on another device/);
  assert.doesNotMatch(actions, /forceLogoutOthers|multiSession|count_other_active_sessions/);
  assert.doesNotMatch(form, /forceLogoutOthers|multiSession/);
});

test("the old device is checked against the auth server on its next request", async () => {
  const proxy = await read("proxy.ts");
  assert.match(proxy, /supabase\.auth\.getUser\(\)/);
});
