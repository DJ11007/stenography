"use server";

import { requireAdmin, requireStudent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { GameRoomGame, GameRoomParticipant } from "@/lib/game-rooms";

type RoomSummary = { id: string; code: string; game: GameRoomGame; status: string; config: Record<string, unknown> };
type JoinResult = { id: string; game: GameRoomGame; status: string; config: Record<string, unknown>; student_id: string };
type RecoveredJoinedRoom = RoomSummary & { student_id: string };

const clamp = (n: number, max = Infinity) => (Number.isFinite(n) ? Math.max(0, Math.min(max, n)) : 0);

export async function createGameRoom(game: GameRoomGame, config: Record<string, unknown>): Promise<{ id: string; code: string } | { error: string }> {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_game_room", { p_game: game, p_config: config }).single();
  if (error || !data) return { error: error?.message ?? "Could not create room." };
  const row = data as { id: string; code: string };
  return { id: row.id, code: row.code };
}

export async function getMyHostedRoom(): Promise<RoomSummary | null> {
  await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_my_hosted_room").maybeSingle();
  return (data as RoomSummary | null) ?? null;
}

export async function joinGameRoom(code: string): Promise<JoinResult | { error: string }> {
  await requireStudent();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("join_game_room", { p_code: code }).single();
  if (error || !data) return { error: error?.message ?? "Could not join that room." };
  return data as JoinResult;
}

export async function getMyJoinedRoom(): Promise<RecoveredJoinedRoom | null> {
  await requireStudent();
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_my_joined_room").maybeSingle();
  return (data as RecoveredJoinedRoom | null) ?? null;
}

export async function startGameRoom(roomId: string): Promise<{ error: string | null }> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("start_game_room", { p_room_id: roomId });
  return { error: error?.message ?? null };
}

export async function finishGameRoom(roomId: string): Promise<{ error: string | null }> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("finish_game_room", { p_room_id: roomId });
  return { error: error?.message ?? null };
}

// Fire-and-forget from the client's own progress-push timer -- never
// trusted as a final result, purely a live position for the leaderboard.
//
// Real reported bug: live races with many students were slow to update,
// and a lot of students' final results showed 0 WPM even though their
// own screen had been showing a real speed. Root cause: requireStudent()
// costs two sequential Supabase round trips of its own on top of this
// RPC call -- a live auth.getUser() network hit (Supabase always
// revalidates against its Auth server, never just reading a local
// cookie) plus a separate profiles table lookup -- and this is the
// single highest-frequency call in the whole feature (pushed by every
// racing student roughly once a second, continuously, for the whole
// race). At classroom scale that's a lot of concurrent extra Supabase
// Auth API traffic, worth avoiding: Supabase's own Auth API has its own
// rate limit, confirmed hit repeatedly in this same environment under
// far lighter load than a real classroom. When it fails here, the
// failure is silent (fire-and-forget, no error handling) -- the
// student's OWN screen keeps showing their real, locally-computed speed
// regardless, while the server-side row this RPC would have updated
// simply never gets the write, staying at its default 0. That's exactly
// the same shape as the original 0-WPM report.
//
// Removing the app-layer check here doesn't weaken authorization at all:
// the RPC's own row-scoped `where room_id = p_room_id and student_id =
// auth.uid()` (backed by Postgres/PostgREST's own independent,
// cryptographic verification of the request's JWT -- not anything this
// app layer decided) is already the real, sole enforcement. An
// unauthenticated or wrong-student request matches zero rows either way
// and gets rejected by the RPC itself ("not a participant of this
// room"); the app-layer call was pure redundant latency for this one
// action.
export async function updateGameRoomProgress(roomId: string, progress: number, wpm: number): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc("update_game_room_progress", { p_room_id: roomId, p_progress: clamp(progress, 100), p_wpm: clamp(wpm) });
}

export async function submitGameRoomResult(roomId: string, score: number, wpm: number, accuracy: number): Promise<void> {
  await requireStudent();
  const supabase = await createClient();
  await supabase.rpc("submit_game_room_result", { p_room_id: roomId, p_score: clamp(score), p_wpm: clamp(wpm), p_accuracy: clamp(accuracy, 100) });
}

// A student polling their own known room_id needs to detect the
// 'racing' -> 'finished' transition even after it's finished (see the
// SQL function's own comment for why get_my_joined_room can't do this).
//
// Real reported bug: live races with many students were slow. This and
// listGameRoomParticipants right below are the two other high-frequency
// polls (once every ~1.5s, continuously, from every participant AND the
// host) -- requireUser() used to add its own live auth.getUser() network
// round trip on top of the RPC call itself for no real benefit: the RPC
// ("host or participant of this room" for the roster, or a plain status
// read here) is already the actual, sole enforcement, backed by
// Postgres/PostgREST's own independent JWT verification -- not anything
// this app layer decided. Removed for the same reason as
// updateGameRoomProgress just above.
export async function getGameRoomStatus(roomId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_game_room_status", { p_room_id: roomId }).maybeSingle();
  return (data as { status: string } | null)?.status ?? null;
}

// Readable by the host or any participant -- the RPC itself enforces the
// real "host or participant of this room" authorization; see the comment
// on getGameRoomStatus just above for why no app-layer check is needed
// on top of that here either.
export async function listGameRoomParticipants(roomId: string): Promise<GameRoomParticipant[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_game_room_participants", { p_room_id: roomId });
  if (error || !Array.isArray(data)) return [];
  return data as GameRoomParticipant[];
}
