import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("the Learn Typing journey page (English Typing / Kruti Dev / Mangal Unicode) has a way back to the Typing Hub", async () => {
  const page = await read("app/typing/learn/page.tsx");
  assert.match(page, /import \{ BackButton \} from "\.\.\/\.\.\/_components\/back-button";/);
  assert.match(page, /<BackButton href="\/typing" label="Typing Hub" dark\/>/);
});
