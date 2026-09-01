import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

// The repo already had a proper multi-resolution app/favicon.ico (Next's
// App Router auto-detects it and injects a <link rel="icon">) -- the real
// bug was that app/layout.tsx also declared metadata.icons pointing at the
// raw, un-sized 2740x2745 logo PNG, which conflicted with/overrode that
// auto-detection. app/icon.png is new: an additional, properly-sized
// (512x512) PNG variant for contexts that prefer it, alongside the
// existing favicon.ico, not a replacement for it.
test("app/favicon.ico is a valid, non-trivial multi-resolution ICO (must not be replaced with a lower-quality single-size file)", () => {
  const path = new URL("../app/favicon.ico", import.meta.url);
  assert.ok(existsSync(path), "app/favicon.ico should exist");
  const bytes = readFileSync(path);
  assert.equal(bytes.readUInt16LE(0), 0); // reserved
  assert.equal(bytes.readUInt16LE(2), 1); // type: icon
  assert.ok(bytes.readUInt16LE(4) >= 2, "favicon.ico should carry more than one resolution");
  assert.ok(bytes.length > 10_000, `favicon.ico shrank unexpectedly: ${bytes.length} bytes`);
});

test("app/icon.png exists and is a real, reasonably sized PNG", () => {
  const path = new URL("../app/icon.png", import.meta.url);
  assert.ok(existsSync(path), "app/icon.png should exist");
  const bytes = readFileSync(path);
  assert.deepEqual([...bytes.slice(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); // PNG signature
  assert.ok(bytes.length > 1000 && bytes.length < 200_000, `unexpected favicon PNG size: ${bytes.length} bytes`);
});

test("layout metadata no longer declares a conflicting icon -- Next generates the <link rel=\"icon\"> tags itself from app/favicon.ico and app/icon.png", () => {
  const layout = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(layout, /icons:\s*\{/);
});
