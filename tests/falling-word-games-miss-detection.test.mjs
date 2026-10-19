import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

// transitionend bubbles: the amber ring shown on the first typed letter (box-shadow, 150ms) used to
// count as the word reaching the bottom, so the word vanished as missed and the next one fell.
for (const [file, handler] of [
  ["app/typing/games/wordtris/wordtris-game.tsx", "onMiss(drop.id)"],
  ["app/typing/games/word-defender/word-defender-game.tsx", "onImpact(enemy.id)"],
]) {
  test(`${file}: only the element's own fall (top) ends the drop`, async () => {
    const source = await read(file);
    assert.ok(source.includes(`onTransitionEnd={(event) => { if (falling && event.target === event.currentTarget && event.propertyName === "top") ${handler}; }}`));
    assert.ok(!source.includes(`onTransitionEnd={() => { if (falling) ${handler}; }}`));
  });
}
