import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { canReviewAdministratorRecovery, genericRecoveryResponse, recoveryRequestIsUsable } from "../lib/recovery-policy.ts";

test("expired and already-used recovery requests cannot be consumed", () => {
  const now = new Date("2026-08-16T12:00:00Z");
  assert.equal(recoveryRequestIsUsable(new Date("2026-08-16T11:59:59Z"), null, now), false);
  assert.equal(recoveryRequestIsUsable(new Date("2026-08-16T13:00:00Z"), new Date(), now), false);
  assert.equal(recoveryRequestIsUsable(new Date("2026-08-16T13:00:00Z"), null, now), true);
});

test("ordinary administrators cannot review administrator recovery", () => {
  assert.equal(canReviewAdministratorRecovery("admin", "ordinary"), false);
  assert.equal(canReviewAdministratorRecovery("student", null), false);
  assert.equal(canReviewAdministratorRecovery("admin", "institution_owner"), true);
  assert.equal(canReviewAdministratorRecovery("admin", "platform_owner"), true);
});

test("public recovery response does not disclose account existence", () => {
  assert.equal(genericRecoveryResponse(), genericRecoveryResponse());
  assert.doesNotMatch(genericRecoveryResponse(), /found|exists|unknown email|no account/i);
});

test("first-time administrator MFA enrollment is reachable at AAL1", () => {
  const page = readFileSync(new URL("../app/account/security/page.tsx", import.meta.url), "utf8");
  const settings = readFileSync(new URL("../app/account/security/security-settings.tsx", import.meta.url), "utf8");
  assert.match(page, /requireUser\(\)/);
  assert.doesNotMatch(page, /requireAdmin\(\)/);
  assert.match(settings, /auth\.mfa\.enroll/);
  assert.match(settings, /challengeAndVerify/);
});

test("account security keeps primary identifiers in isolated flows", () => {
  const page = readFileSync(new URL("../app/account/security/page.tsx", import.meta.url), "utf8");
  const settings = readFileSync(new URL("../app/account/security/security-settings.tsx", import.meta.url), "utf8");
  assert.match(page, /currentEmail=\{user\.email/);
  assert.match(page, /phoneEnabled=\{phoneRecoveryEnabled\(\)\}/);
  assert.match(settings, /changePrimaryEmail/);
  assert.match(settings, /updateUser\(\{ email \}\)/);
  assert.match(settings, /changePrimaryPhone/);
  assert.match(settings, /updateUser\(\{ phone \}\)/);
  assert.doesNotMatch(settings, /updateUser\(\{\s*email\s*,\s*phone/);
  assert.doesNotMatch(settings, /backup recovery contacts|Recovery contacts/);
});
