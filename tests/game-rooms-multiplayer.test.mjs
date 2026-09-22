import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { gameRoomPodiumMessage } from "../lib/game-rooms.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const migration = () => read("supabase/migrations/202609192300_game_rooms.sql");

const adminId = "00000000-0000-4000-8000-000000000009";
const studentId = "00000000-0000-4000-8000-000000000001";
const student2Id = "00000000-0000-4000-8000-000000000002";

// A prior fix (61fd1dd) for this exact "column reference is ambiguous"
// bug class was verified only by matching strings against the SQL text
// -- which is why it missed this one: `on conflict (room_id, student_id)`
// reads as perfectly fine text, but join_game_room's own OUT parameter
// (returns table(..., student_id uuid)) makes that bare conflict-target
// column list genuinely ambiguous to plpgsql, and only running the SQL
// for real (via PGlite) against a real Postgres engine ever catches it.
async function database() {
  const db = new PGlite();
  await db.exec(`
create role anon; create role authenticated;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('app.current_uid', true), '')::uuid $$;
create table auth.users(id uuid primary key);
create table public.profiles(id uuid primary key, role text default 'student', full_name text);
create function public.is_aal2_admin() returns boolean language sql stable as $$ select exists(select 1 from public.profiles where id=auth.uid() and role='admin') $$;
insert into auth.users values ('${adminId}'), ('${studentId}'), ('${student2Id}');
insert into public.profiles values ('${adminId}','admin','Admin'), ('${studentId}','student','Student One'), ('${student2Id}','student','Student Two');
`);
  await db.exec(await migration());
  return db;
}
const asUser = (db, id) => db.query("select set_config('app.current_uid', $1, false)", [id]);

// Real reported bug, live-tested by the admin hosting a race: joining
// threw "column reference \"student_id\" is ambiguous" every time, even
// on a student's very first join (not just a rejoin). Isolated to the
// exact statement via PGlite: an identical insert with no ON CONFLICT
// clause works fine, and the OUT parameter alone doesn't cause it either
// -- it's specifically the bare "(room_id, student_id)" conflict-target
// column list that plpgsql can't tell apart from its own OUT parameter.
// Naming the unique constraint directly, instead of listing its columns,
// sidesteps the ambiguity entirely.
test("a student can actually join a room, rejoin it (exercising the ON CONFLICT DO UPDATE path), and the host can list the roster -- executed for real against a Postgres engine, not just pattern-matched", async () => {
  const db = await database();
  await asUser(db, adminId);
  const created = await db.query("select * from public.create_game_room('speed-race', '{}'::jsonb)");
  const roomId = created.rows[0].id;
  const code = created.rows[0].code;

  await asUser(db, studentId);
  const joined = await db.query("select * from public.join_game_room($1)", [code]);
  assert.equal(joined.rows[0].student_id, studentId);

  await asUser(db, student2Id);
  await db.query("select * from public.join_game_room($1)", [code]);

  // Rejoining is the ON CONFLICT DO UPDATE path -- this is exactly what
  // threw the ambiguity error live.
  await asUser(db, studentId);
  const rejoined = await db.query("select * from public.join_game_room($1)", [code]);
  assert.equal(rejoined.rows[0].student_id, studentId);

  await asUser(db, adminId);
  const roster = await db.query("select student_id from public.list_game_room_participants($1) order by joined_at", [roomId]);
  assert.deepEqual(roster.rows.map((r) => r.student_id), [studentId, student2Id]);

  await db.query("select public.start_game_room($1)", [roomId]);
  const status = await db.query("select * from public.get_game_room_status($1)", [roomId]);
  assert.equal(status.rows[0].status, "racing");

  await db.close();
});

test("the exact requested podium messaging: gold/topper, silver/try harder, bronze/keep fighting, nothing for the rest", () => {
  assert.equal(gameRoomPodiumMessage(1), "🥇 Congratulations, you are the topper!");
  assert.equal(gameRoomPodiumMessage(2), "🥈 Try harder!");
  assert.equal(gameRoomPodiumMessage(3), "🥉 Keep fighting!");
  assert.equal(gameRoomPodiumMessage(4), null);
  assert.equal(gameRoomPodiumMessage(null), null);
});

test("the migration is begin/commit wrapped, RLS-enabled with no policies (SECURITY DEFINER RPCs only), matching the wordtris_scores precedent", async () => {
  const sql = await migration();
  assert.match(sql, /^begin;/);
  assert.match(sql, /commit;\s*$/);
  assert.match(sql, /alter table public\.game_rooms enable row level security;/);
  assert.match(sql, /alter table public\.game_room_participants enable row level security;/);
  assert.doesNotMatch(sql, /create policy/);
});

test("room creation and lifecycle transitions are host-only, gated by the same aal2 admin bar as other admin write RPCs", async () => {
  const sql = await migration();
  assert.match(sql, /if not public\.is_aal2_admin\(\) then raise exception 'not authorized'; end if;/);
  assert.match(sql, /where id = p_room_id and host_id = auth\.uid\(\) and status = 'waiting';/); // start_game_room
  assert.match(sql, /where id = p_room_id and host_id = auth\.uid\(\) and status <> 'finished';/); // finish_game_room
});

// Real design intent: joining is only allowed while a room is still
// 'waiting' -- once the teacher starts the race, latecomers can't sneak
// into an already-running room.
test("a room can only be joined while status is 'waiting', and student_name is resolved server-side, never trusted from the client", async () => {
  const sql = await migration();
  assert.match(sql, /where gr\.code = upper\(trim\(p_code\)\) and gr\.status = 'waiting'/);
  assert.match(sql, /select coalesce\(nullif\(trim\(pr\.full_name\),''\),'Student'\) into student_name\s*\n\s*from public\.profiles pr where pr\.id = auth\.uid\(\);/);
});

// Real reported bug: several functions' `returns table(...)` output
// columns share names with the actual game_rooms/game_room_participants
// columns (code, status, id, student_id) -- Postgres raised "column
// reference is ambiguous" for every unqualified reference to one of those
// names inside the function body, since it can't tell the OUT parameter
// from the table column apart. Fixed by aliasing every affected table and
// qualifying every such reference; this guards against it recurring.
test("every unqualified reference to an OUT-parameter-shadowed column name has been fixed with a table alias", async () => {
  const sql = await migration();
  assert.match(sql, /select 1 from public\.game_rooms gr where gr\.code = new_code and gr\.status <> 'finished'/); // create_game_room's code-uniqueness loop
  assert.match(sql, /select gr\.id, gr\.code, gr\.game, gr\.status, gr\.config from public\.game_rooms gr/); // get_my_hosted_room
  assert.doesNotMatch(sql, /select id, code, game, status, config from public\.game_rooms/); // the old, ambiguous form
  // join_game_room's own ON CONFLICT target column list -- the one
  // instance the earlier alias-based fix above missed entirely (a column
  // list can't be table-qualified the way a SELECT list can), only found
  // by actually executing the SQL (see the PGlite test above).
  assert.match(sql, /on conflict on constraint game_room_participants_room_id_student_id_key/);
  assert.doesNotMatch(sql, /on conflict \(room_id, student_id\)/);
});

test("submit_game_room_result recomputes rank for every participant in the room by score, then wpm, then earliest finish", async () => {
  const sql = await migration();
  assert.match(sql, /order by score desc nulls last, wpm desc nulls last, finished_at asc nulls last/);
  assert.match(sql, /update public\.game_room_participants gp\s*\n\s*set rank = ranked\.rn/);
});

// Real reported bug precedent (WordTris admin preview): a student-gated
// action called from a session without the right role redirects/errors
// instead of degrading gracefully. Here the equivalent risk is a
// non-participant reading another room's roster -- confirm the
// authorization check exists on both read RPCs.
test("the participant roster and room-status RPCs are only readable by the room's host or one of its own participants", async () => {
  const sql = await migration();
  const listFn = sql.slice(sql.indexOf("function public.list_game_room_participants"), sql.indexOf("function public.list_game_room_participants") + 700);
  assert.match(listFn, /select 1 from public\.game_rooms gr where gr\.id = p_room_id and gr\.host_id = auth\.uid\(\)/);
  assert.match(listFn, /select 1 from public\.game_room_participants gp where gp\.room_id = p_room_id and gp\.student_id = auth\.uid\(\)/);
  const statusFn = sql.slice(sql.indexOf("function public.get_game_room_status"), sql.indexOf("function public.get_game_room_status") + 700);
  assert.match(statusFn, /select 1 from public\.game_rooms where id = p_room_id and host_id = auth\.uid\(\)/);
});

test("every RPC is revoked from public/anon and granted only to authenticated", async () => {
  const sql = await migration();
  const fns = ["create_game_room", "join_game_room", "start_game_room", "finish_game_room", "update_game_room_progress", "submit_game_room_result", "get_game_room_status", "list_game_room_participants"];
  const revokeBlock = sql.slice(sql.lastIndexOf("revoke all on function"));
  for (const fn of fns) assert.match(revokeBlock, new RegExp(`public\\.${fn}\\(`));
  assert.match(revokeBlock, /from public, anon;/);
  assert.match(revokeBlock, /to authenticated;/);
});

test("the shared multiplayer actions require the right role per action (admin for host actions, student for join/progress/result, any signed-in user for read-only roster/status)", async () => {
  const actions = await read("app/typing/games/_multiplayer/actions.ts");
  assert.match(actions, /export async function createGameRoom[\s\S]{0,200}await requireAdmin\(\);/);
  assert.match(actions, /export async function startGameRoom[\s\S]{0,200}await requireAdmin\(\);/);
  assert.match(actions, /export async function finishGameRoom[\s\S]{0,200}await requireAdmin\(\);/);
  assert.match(actions, /export async function joinGameRoom[\s\S]{0,200}await requireStudent\(\);/);
  assert.match(actions, /export async function updateGameRoomProgress[\s\S]{0,200}await requireStudent\(\);/);
  assert.match(actions, /export async function submitGameRoomResult[\s\S]{0,200}await requireStudent\(\);/);
  assert.match(actions, /export async function listGameRoomParticipants[\s\S]{0,200}await requireUser\(\);/);
});

test("joining a live race forces the host's identical passage/pace/category onto the student, never their own picker", async () => {
  const game = await read("app/typing/games/speed-race/speed-race-game.tsx");
  assert.match(game, /const cfg = room\.config;\s*\n\s*setLanguage\(cfg\.language\);\s*\n\s*setCategory\(cfg\.category\);\s*\n\s*setPaceWpm\(cfg\.paceWpm\);\s*\n\s*setPassage\(cfg\.passage\);/);
});

test("Speed Race pushes live progress on a stable interval (not one that resets every keystroke) via a ref, not a state dependency", async () => {
  const game = await read("app/typing/games/speed-race/speed-race-game.tsx");
  assert.match(game, /const liveStateRef = useRef\(\{ typed: "", passage: "", liveWpm: 0 \}\);/);
  assert.match(game, /liveStateRef\.current = \{ typed, passage, liveWpm \};/);
  assert.match(game, /}, \[step, room\]\);\s*\n\s*\n\s*useEffect\(\(\) => \{\s*\n\s*if \(step !== "racing" \|\| !room\) return;\s*\n\s*const tick = \(\) => \{ listGameRoomParticipants/);
});

test("the admin host page and Live Classroom Race nav entry exist", async () => {
  const admin = await read("app/admin/page.tsx");
  assert.match(admin, /\/admin\/live-race/);
  const page = await read("app/admin/live-race/page.tsx");
  assert.match(page, /await requireAdmin\(\);/);
  const host = await read("app/admin/live-race/live-race-host.tsx");
  assert.match(host, /createGameRoom\("speed-race", config\)/);
});
