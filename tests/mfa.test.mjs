import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normalizeTotpQr } from "../lib/mfa.ts";

test("TOTP SVG data URLs have trailing whitespace removed", () => {
  const qr = "data:image/svg+xml;charset=utf-8,%3Csvg%3E%3C/svg%3E\n  ";
  assert.equal(normalizeTotpQr(qr), "data:image/svg+xml;charset=utf-8,%3Csvg%3E%3C/svg%3E");
});

test("non-SVG TOTP QR values are rejected", () => {
  assert.equal(normalizeTotpQr("https://example.com/qr.svg"), null);
  assert.equal(normalizeTotpQr("javascript:alert(1)"), null);
});

test("MFA enrollment data is not logged and incomplete factors can be removed", () => {
  const source = readFileSync(new URL("../app/account/security/security-settings.tsx", import.meta.url), "utf8");
  assert.match(source, /normalizeTotpQr\(data\.totp\.qr_code\)/);
  assert.match(source, /<Image src=\{enrollment\.qr\}[^>]+unoptimized/);
  assert.match(source, /auth\.mfa\.unenroll/);
  assert.doesNotMatch(source, /console\.(?:log|debug|info|warn|error)/);
});
