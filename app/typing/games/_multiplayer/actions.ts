"use server";

import { requireAdmin, requireStudent, requireUser } from "@/lib/auth";
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
export async function updateGameRoomProgress(roomId: string, progress: number, wpm: number): Promise<void> {
  await requireStudent();
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
export async function getGameRoomStatus(roomId: string): Promise<string | null> {
  await requireUser();
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_game_room_status", { p_room_id: roomId }).maybeSingle();
  return (data as { status: string } | null)?.status ?? null;
}

// Readable by the host or any participant -- requireUser() only confirms
// "signed in"; the RPC itself enforces the real "host or participant of
// this room" authorization.
export async function listGameRoomParticipants(roomId: string): Promise<GameRoomParticipant[]> {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_game_room_participants", { p_room_id: roomId });
  if (error || !Array.isArray(data)) return [];
  return data as GameRoomParticipant[];
}
