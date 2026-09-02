import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const LOGO_PATH = fileURLToPath(new URL("../public/samradhi-classes-logo.png", import.meta.url));

// A dedicated test file exists for this precisely because of a real
// mistake: an earlier pass only checked that app/favicon.ico was a
// *structurally* valid multi-resolution ICO -- it never actually verified
// which image was inside it. It turned out to be some unrelated generic
// icon (a black circle with a triangle), not the Samradhi Classes logo,
// and that passed the structural check just fine. These tests now also
// decode each embedded frame and compare it, perceptually, against a
// fresh render of the real logo, so a wrong-but-structurally-valid ICO
// can't pass again. A perceptual/tolerant check (not byte-exact) is used
// deliberately -- different PNG encode settings (e.g. quality) produce
// legitimately different bytes for the same visual image, so an exact
// comparison would be fragile against benign re-encoding, not just against
// a genuinely wrong image.

function readIcoFrames(bytes) {
  const count = bytes.readUInt16LE(4);
  const frames = [];
  for (let i = 0; i < count; i++) {
    const entryOffset = 6 + i * 16;
    const size = bytes.readUInt32LE(entryOffset + 8);
    const offset = bytes.readUInt32LE(entryOffset + 12);
    frames.push(bytes.subarray(offset, offset + size));
  }
  return frames;
}

// Downscale both images to the same small size and compare mean absolute
// per-channel difference -- robust to encoder/quantization differences,
// sensitive to "this is a completely different picture." Comparing at (at
// most) the smaller image's own native size, rather than a fixed size,
// matters for tiny favicon frames (16x16): upscaling an already-16x16
// render back up to compare would amplify pixelation into a difference
// that has nothing to do with whether it's the right logo.
async function meanAbsoluteDifference(imageA, imageB, maxSize = 24) {
  const [metaA, metaB] = await Promise.all([sharp(imageA).metadata(), sharp(imageB).metadata()]);
  const size = Math.max(4, Math.min(maxSize, metaA.width, metaA.height, metaB.width, metaB.height));
  const [a, b] = await Promise.all(
    [imageA, imageB].map((input) =>
      sharp(input).resize(size, size, { fit: "fill" }).removeAlpha().raw().toBuffer()
    )
  );
  let total = 0;
  for (let i = 0; i < a.length; i++) total += Math.abs(a[i] - b[i]);
  return total / a.length;
}

test("app/favicon.ico is a valid multi-resolution ICO", () => {
  const path = new URL("../app/favicon.ico", import.meta.url);
  assert.ok(existsSync(path), "app/favicon.ico should exist");
  const bytes = readFileSync(path);
  assert.equal(bytes.readUInt16LE(0), 0); // reserved
  assert.equal(bytes.readUInt16LE(2), 1); // type: icon
  assert.ok(bytes.readUInt16LE(4) >= 2, "favicon.ico should carry more than one resolution");
});

test("every frame in app/favicon.ico is a real PNG that actually depicts the Samradhi Classes logo, not a placeholder", async () => {
  const bytes = readFileSync(new URL("../app/favicon.ico", import.meta.url));
  const frames = readIcoFrames(bytes);
  assert.ok(frames.length >= 2);
  for (const frame of frames) {
    assert.deepEqual([...frame.slice(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); // PNG signature
    const difference = await meanAbsoluteDifference(frame, LOGO_PATH);
    assert.ok(difference < 15, `favicon frame does not visually match the real logo (mean difference ${difference.toFixed(1)}/255)`);
  }
});

test("app/icon.png is a real PNG that actually depicts the Samradhi Classes logo", async () => {
  const path = new URL("../app/icon.png", import.meta.url);
  assert.ok(existsSync(path), "app/icon.png should exist");
  const bytes = readFileSync(path);
  assert.deepEqual([...bytes.slice(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); // PNG signature
  assert.ok(bytes.length > 1000 && bytes.length < 200_000, `unexpected favicon PNG size: ${bytes.length} bytes`);
  const difference = await meanAbsoluteDifference(bytes, LOGO_PATH);
  assert.ok(difference < 15, `icon.png does not visually match the real logo (mean difference ${difference.toFixed(1)}/255)`);
});

test("layout metadata no longer declares a conflicting icon -- Next generates the <link rel=\"icon\"> tags itself from app/favicon.ico and app/icon.png", () => {
  const layout = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(layout, /icons:\s*\{/);
});
