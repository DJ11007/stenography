// Live multiplayer game rooms: a teacher hosts a room for one of the
// typing games, students join by a short code, and everyone races the
// same challenge together with a live, polling leaderboard. Shared types
// and pure helpers used by both the admin host UI and each game's own
// "join a live race" flow.

export type GameRoomGame = "speed-race" | "word-defender" | "wordtris";
export type GameRoomStatus = "waiting" | "racing" | "finished";

export type GameRoomParticipant = {
  student_id: string;
  student_name: string;
  joined_at: string;
  live_progress: number;
  live_wpm: number;
  updated_at: string;
  finished_at: string | null;
  score: number | null;
  wpm: number | null;
  accuracy: number | null;
  rank: number | null;
};

// Every client (host dashboard, each racing student) polls
// list_game_room_participants on this schedule -- frequent enough to feel
// live, cheap enough for a classroom-scale room (a few dozen students).
//
// Real reported bug: live races with many students were slow to update,
// and results often showed 0 WPM for students whose own screen had a
// real speed. The actual bottleneck wasn't this interval -- it was two
// redundant Supabase round trips (a live auth re-check plus a profiles
// lookup) this app layer added on top of every single poll/push, which
// is what was actually slow and, under load, silently dropping progress
// pushes (see the removed requireStudent()/requireUser() calls in
// app/typing/games/_multiplayer/actions.ts for the full explanation).
// With those gone, each poll/push is now just the one RPC call it always
// should have been, so tightening this further is now safe without
// multiplying Supabase's own Auth API traffic the way a blind "poll N
// times faster" would have on the OLD, heavier per-call cost.
export const GAME_ROOM_POLL_MS = 800;
// Each racing student pushes its own live position on this schedule.
export const GAME_ROOM_PROGRESS_PUSH_MS = 600;

export const GAME_ROOM_LABELS: Record<GameRoomGame, string> = {
  "speed-race": "Speed Race",
  "word-defender": "Word Defender",
  "wordtris": "WordTris",
};

// Exact messaging the admin asked for: gold/topper, silver/try harder,
// bronze/keep fighting, nothing special beyond that.
export function gameRoomPodiumMessage(rank: number | null): string | null {
  if (rank === 1) return "🥇 Congratulations, you are the topper!";
  if (rank === 2) return "🥈 Try harder!";
  if (rank === 3) return "🥉 Keep fighting!";
  return null;
}

export function gameRoomPodiumTone(rank: number | null): string {
  if (rank === 1) return "from-amber-400 to-yellow-500 text-amber-950";
  if (rank === 2) return "from-slate-300 to-slate-400 text-slate-900";
  if (rank === 3) return "from-orange-400 to-amber-600 text-orange-950";
  return "bg-slate-50 text-slate-700";
}
