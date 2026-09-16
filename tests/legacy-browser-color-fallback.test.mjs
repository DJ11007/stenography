import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

// Real reported bug: students on Windows 7 (frozen at Chrome ~109, since
// Chrome dropped Windows 7 support after v109) saw most of the site as
// invisible/washed-out text and backgrounds. Tailwind v4's entire color
// palette is defined in oklch(), its opacity-modifier utilities (e.g.
// bg-blue-600/20) compile to color-mix(in oklab, ...), and its bundled
// build step hardcodes a Chrome 111+/Safari 16.4+/Firefox 128+ target
// with no project-level override -- any older browser treats all of
// these as invalid declarations and drops them, leaving affected
// elements with no color at all.
test("postcss.config.mjs runs postcss-preset-env after Tailwind with an explicit low browser floor, so oklch/color-mix colors get a legacy rgb() fallback", async () => {
  const config = await read("postcss.config.mjs");
  assert.match(config, /"@tailwindcss\/postcss": \{\}/);
  assert.match(config, /"postcss-preset-env": \{/);
  assert.match(config, /browsers: "Chrome >= 49, Firefox >= 50, Safari >= 10, iOS >= 10, Edge >= 15, not dead"/);
  assert.match(config, /"oklab-function": true/);
  assert.match(config, /"color-mix-function": true/);
  assert.match(config, /"custom-properties": true/);
  // Tailwind's own key order matters: postcss-preset-env must see the
  // oklch()/color-mix() output Tailwind produces, so it has to run after.
  assert.ok(config.indexOf('"@tailwindcss/postcss"') < config.indexOf('"postcss-preset-env"'));
});

// Follow-up: postcss-preset-env's gradient-interpolation-method feature
// (and any other build-time CSS tool) can only rewrite a color-space
// hint that appears literally as an argument to a linear-gradient() call
// in the stylesheet text. Tailwind's bg-gradient-to-* utilities instead
// stash the hint in `--tw-gradient-position` and only combine it with
// colors later, at paint time, via `linear-gradient(var(--tw-gradient-
// stops))` -- invisible to any static analysis -- so it has to be
// overridden directly in globals.css instead.
test("globals.css overrides --tw-gradient-position for every bg-gradient-to-* direction, stripping the invisible color-space hint that breaks old browsers", async () => {
  const css = await read("app/globals.css");
  for (const [utility, value] of [
    ["t", "to top"],
    ["tr", "to top right"],
    ["r", "to right"],
    ["br", "to bottom right"],
    ["b", "to bottom"],
    ["bl", "to bottom left"],
    ["l", "to left"],
    ["tl", "to top left"],
  ]) {
    assert.match(css, new RegExp(`\\.bg-gradient-to-${utility} \\{ --tw-gradient-position: ${value} !important; \\}`));
  }
});
