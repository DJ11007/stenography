import test from "node:test";
import assert from "node:assert/strict";
import { Window } from "happy-dom";

// The students' question bar (Word / Excel, practice and live exam) laid out like the admin's Model Answer bar: the
// question buttons in one row, the marks and a Hide/Show arrow at the right, the question text underneath. The arrow
// folds only the text, so the buttons stay.
const window = new Window();
Object.assign(globalThis, { window, document: window.document, HTMLElement: window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true });
const React = await import("react");
const { createRoot } = await import("react-dom/client");

// Node runs .ts but not .tsx: the two components are compiled with TypeScript into a temporary folder in the project
// (so "react" still resolves), their "@/" imports pointed at the real lib files.
const { readFile, writeFile, mkdir, rm } = await import("node:fs/promises");
const ts = (await import("typescript")).default;
const root = new URL("../", import.meta.url), tmp = new URL("../tests/.tmp-question-bar/", import.meta.url);
await mkdir(tmp, { recursive: true });
const compile = async (source, target, imports) => {
  let code = ts.transpileModule(await readFile(new URL(source, root), "utf8"), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  for (const [from, to] of Object.entries(imports)) code = code.split(`"${from}"`).join(`"${to}"`);
  await writeFile(new URL(target, tmp), code);
};
await compile("components/efficiency/question-content.tsx", "question-content.mjs", { "@/lib/question-content": new URL("lib/question-content.ts", root).href });
await compile("components/efficiency/question-bar.tsx", "question-bar.mjs", { "@/lib/question-parts": new URL("lib/question-parts.ts", root).href, "./question-content": "./question-content.mjs" });
const { QuestionBar } = await import(new URL("question-bar.mjs", tmp).href);
test.after(() => rm(tmp, { recursive: true, force: true }));

const questions = [1, 2, 3].map((number) => ({ id: `q${number}`, number, instruction: number === 2 ? "Format the range. (a) Bold (b) Red" : `Question text ${number}`, marks: 1.66, section: null }));

test("buttons in one row, text underneath, the arrow hides only the text", async () => {
  const container = document.createElement("div");
  const root = createRoot(container);
  let collapsed = false, current = 1;
  const render = () => React.act(() => { root.render(React.createElement(QuestionBar, { questions, current, onSelect: (index) => { current = index; }, language: "English", collapsed, onToggle: () => { collapsed = !collapsed; } })); });
  await render();
  const nav = container.querySelector('nav[aria-label="Questions"]');
  assert.deepEqual([...nav.querySelectorAll("button")].map((button) => button.textContent), ["Q1", "Q2", "Q3"]);
  assert.match(nav.className, /overflow-x-auto/, "one scrolling row");
  assert.match(container.textContent, /Q2\. Format the range\./);
  assert.match(container.textContent, /a\)Bold/);
  assert.match(container.textContent, /1\.66 marks/);
  container.querySelector('button[aria-label="Hide Questions"]').click();
  await render();
  assert.equal(container.querySelectorAll('nav[aria-label="Questions"] button').length, 3, "the buttons stay");
  assert.doesNotMatch(container.textContent, /Format the range/, "the text is folded away");
  assert.ok(container.querySelector('button[aria-label="Show Questions"]'));
  await React.act(() => { root.unmount(); });
});
