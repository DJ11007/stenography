// Real reported bug: students on Windows 7 (frozen at Chrome ~109, since
// Chrome dropped Windows 7 support after v109) saw most of the site as
// invisible/washed-out text and backgrounds. Tailwind v4's own color
// palette is defined entirely in oklch(), and its opacity-modifier
// utilities (e.g. bg-blue-600/20) compile to color-mix(in oklab, ...) --
// its bundled build step hardcodes a Chrome 111+/Safari 16.4+/Firefox
// 128+ target with no project-level override, so any older browser
// treats both of these as invalid declarations and drops them, leaving
// the element with no color at all.
// postcss-preset-env runs after Tailwind and rewrites both oklch()/
// oklab() colors and color-mix() results down to plain rgb() (understood
// everywhere), plus a wide-gamut color(display-p3 ...) upgrade for
// browsers that support it -- old browsers get the rgb() value, nothing
// else changes for modern ones. The explicit `browsers` target is what
// forces the fallback to be generated at all; leaving it unset would let
// preset-env assume a modern default and skip polyfilling.
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
    "postcss-preset-env": {
      // Explicit, low version floors rather than a relative query like
      // "last N versions" -- a machine that can never update again needs
      // a fixed floor, not one that quietly drifts forward every time
      // browsers release a new version.
      browsers: "Chrome >= 49, Firefox >= 50, Safari >= 10, iOS >= 10, Edge >= 15, not dead",
      features: { "oklab-function": true, "color-mix-function": true, "custom-properties": true },
    },
  },
};

export default config;
