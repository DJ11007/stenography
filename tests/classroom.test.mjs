import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { mapClassroomUpdateRow, mapLiveClassRow } from "../lib/classroom.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("classroom row mapping converts snake_case columns to the camelCase shape the UI expects", () => {
  const update = mapClassroomUpdateRow({ id: "1", title: "Welcome", body: "Class starts Monday", created_at: "2026-01-01T00:00:00Z" });
  assert.deepEqual(update, { id: "1", title: "Welcome", body: "Class starts Monday", createdAt: "2026-01-01T00:00:00Z" });
  const live = mapLiveClassRow({ url: "https://meet.example.com", is_active: true });
  assert.deepEqual(live, { url: "https://meet.example.com", isActive: true });
});

test("the student classroom page requires a logged-in student and shows a disabled join button when the live class is inactive", async () => {
  const page = await read("app/classroom/page.tsx");
  assert.match(page, /await requireStudent\(\)/);
  assert.match(page, /liveClass\.isActive && liveClass\.url/);
  assert.match(page, /aria-disabled="true"/);
  assert.match(page, /No updates found\./);
});

test("the admin classroom page and manager expose live-class control and an updates feed with add/edit/delete", async () => {
  const page = await read("app/admin/classroom/page.tsx");
  const manager = await read("app/admin/classroom/classroom-manager.tsx");
  assert.match(page, /admin_list_classroom_updates/);
  assert.match(page, /get_live_class_link/);
  assert.match(manager, /Save live class/);
  assert.match(manager, /\+ New Update/);
  assert.match(manager, /Delete/);
});

test("the typing hub and admin hub both link to the new classroom feature", async () => {
  const hub = await read("app/typing/page.tsx");
  const admin = await read("app/admin/page.tsx");
  assert.match(hub, /href: "\/classroom"/);
  assert.match(hub, /Seven focused typing areas/);
  assert.match(admin, /"\/admin\/classroom", "Classroom"/);
});
