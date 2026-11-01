import test from "node:test";
import assert from "node:assert/strict";
import { Window } from "happy-dom";

// Real bug, second live exam: at a part's end the hold was decided in an effect, which left one frame without the
// part's screen; the typing screen (and its typed text) was removed and a new one opened that could only say "this part
// is over", so only 2 of 7 Hindi answers were saved. usePartHandIn decides it while rendering. This renders it with
// React and a child that counts how often it is mounted: the very same screen must stay until the answer is in.
const window = new Window();
Object.assign(globalThis, { window, document: window.document, HTMLElement: window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true });
const React = await import("react");
const { createRoot } = await import("react-dom/client");
const { act } = React;
const { usePartHandIn } = await import("../app/live-exam/[examId]/use-part-hand-in.ts");

const A = { id: "hindi" }, B = { id: "english" };
function setup(preview = false) {
  const log = { mounts: [], removed: [], handIn: null };
  function Screen({ part }) {
    React.useEffect(() => { log.mounts.push(part.id); return () => { log.removed.push(part.id); }; }, [part.id]);
    return React.createElement("p", null, part.id);
  }
  function Room({ open }) {
    const { active, handIn } = usePartHandIn(open, preview);
    log.handIn = handIn;
    return active ? React.createElement(Screen, { key: active.id, part: active }) : React.createElement("p", null, "break");
  }
  const container = document.createElement("div");
  const root = createRoot(container);
  const show = (open) => act(() => { root.render(React.createElement(Room, { open })); });
  return { log, show, text: () => container.textContent, root };
}

test("at the end second the same screen stays — never a frame without it, never a second copy", async () => {
  const { log, show, text, root } = setup();
  await show(A);
  await show(null); // the part ends: the server clock reached its end time
  assert.equal(text(), "hindi", "still the Hindi screen");
  assert.deepEqual(log.mounts, ["hindi"], "mounted once: not removed and opened again");
  assert.deepEqual(log.removed, [], "never removed while handing in");
  await act(() => { log.handIn("hindi"); }); // its answer reached the server
  assert.equal(text(), "break");
  await act(() => { root.unmount(); });
});

test("the next part always comes first, even if the last one is still handing in", async () => {
  const { log, show, text, root } = setup();
  await show(A);
  await show(null);
  assert.equal(text(), "hindi");
  await show(B); // the break is over and English starts
  assert.equal(text(), "english");
  assert.deepEqual(log.mounts, ["hindi", "english"]);
  await show(null); // English ends: it is held, not the old Hindi
  assert.equal(text(), "english");
  await act(() => { root.unmount(); });
});

test("a part already handed in, or an admin preview, goes straight to the break", async () => {
  const handed = setup();
  await handed.show(A);
  await act(() => { handed.log.handIn("hindi"); });
  await handed.show(null);
  assert.equal(handed.text(), "break");
  await act(() => { handed.root.unmount(); });
  const preview = setup(true);
  await preview.show(A);
  await preview.show(null);
  assert.equal(preview.text(), "break");
  await act(() => { preview.root.unmount(); });
});
