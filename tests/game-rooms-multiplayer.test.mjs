import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { gameRoomPodiumMessage } from "../lib/game-rooms.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const migration = () => read("supabase/migrations/202609192300_game_rooms.sql");

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
  assert.match(sql, /where code = upper\(trim\(p_code\)\) and status = 'waiting'/);
  assert.match(sql, /select coalesce\(nullif\(trim\(full_name\),''\),'Student'\) into student_name\s*\n\s*from public\.profiles where id = auth\.uid\(\);/);
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
  assert.match(listFn, /select 1 from public\.game_rooms where id = p_room_id and host_id = auth\.uid\(\)/);
  assert.match(listFn, /select 1 from public\.game_room_participants where room_id = p_room_id and student_id = auth\.uid\(\)/);
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
