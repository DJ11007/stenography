begin;

-- Live multiplayer game rooms: a teacher hosts a room for one of the
-- typing games (currently Speed Race; Word Defender/WordTris can reuse
-- this same schema later), shares a short room code verbally in class,
-- and up to ~50 students join by entering that code. Same shape as
-- wordtris_word_banks: plain tables reachable only through
-- security-definer RPCs (RLS on, no policies).
--
-- Live progress during a race is polled, not pushed over a realtime
-- channel -- this codebase has no existing Realtime Broadcast usage, and
-- polling every ~1-2s against these two small, indexed tables is trivial
-- at classroom scale (a few dozen concurrent students), so it's the
-- simpler, more robust choice for a first version.
--
-- Trust level matches the games themselves (Speed Race/Word Defender/
-- WordTris keep their own solo personal-best scores in localStorage, not
-- server-validated) -- this is a friendly live classroom leaderboard, not
-- a graded, anti-cheat-hardened exam result. Scores are still clamped to
-- sane ranges server-side as a basic sanity check.
create table if not exists public.game_rooms(
  id uuid primary key default gen_random_uuid(),
  code text not null,
  game text not null check (game in ('speed-race','word-defender','wordtris')),
  host_id uuid not null references public.profiles(id),
  status text not null default 'waiting' check (status in ('waiting','racing','finished')),
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);
alter table public.game_rooms enable row level security;
-- Not a unique constraint: a finished room's code can be reused by a
-- later room without the site ever running out of short codes. Lookups
-- always filter to non-finished rooms (see join_game_room below), so a
-- collision with an old finished room is harmless.
create index if not exists game_rooms_code_idx on public.game_rooms(code) where status <> 'finished';
create index if not exists game_rooms_host_idx on public.game_rooms(host_id, status);

create table if not exists public.game_room_participants(
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.game_rooms(id) on delete cascade,
  student_id uuid not null references public.profiles(id),
  student_name text not null,
  joined_at timestamptz not null default now(),
  live_progress numeric not null default 0,
  live_wpm numeric not null default 0,
  updated_at timestamptz not null default now(),
  finished_at timestamptz,
  score numeric,
  wpm numeric,
  accuracy numeric,
  rank int,
  unique(room_id, student_id)
);
alter table public.game_room_participants enable row level security;
create index if not exists game_room_participants_room_idx on public.game_room_participants(room_id);

-- Generates a short (5 hex-character) room code, retried until it's free
-- among currently non-finished rooms. Host-only (same aal2 admin bar as
-- the rest of this codebase's admin write RPCs).
create or replace function public.create_game_room(p_game text, p_config jsonb)
returns table(id uuid, code text)
language plpgsql security definer set search_path=public as $fn$
declare
  new_code text;
  attempt int := 0;
  new_row public.game_rooms;
begin
  if not public.is_aal2_admin() then raise exception 'not authorized'; end if;
  if p_game not in ('speed-race','word-defender','wordtris') then raise exception 'Invalid game.'; end if;
  loop
    new_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 5));
    attempt := attempt + 1;
    exit when attempt > 20 or not exists (
      select 1 from public.game_rooms gr where gr.code = new_code and gr.status <> 'finished'
    );
  end loop;
  insert into public.game_rooms(code, game, host_id, config)
  values (new_code, p_game, auth.uid(), coalesce(p_config, '{}'::jsonb))
  returning * into new_row;
  return query select new_row.id, new_row.code;
end $fn$;

-- The host's own currently-open (non-finished) room, so refreshing the
-- host dashboard recovers state without needing localStorage tricks.
create or replace function public.get_my_hosted_room()
returns table(id uuid, code text, game text, status text, config jsonb)
language sql stable security definer set search_path=public as $fn$
  select gr.id, gr.code, gr.game, gr.status, gr.config from public.game_rooms gr
  where gr.host_id = auth.uid() and gr.status <> 'finished'
  order by gr.created_at desc limit 1;
$fn$;

-- Any student's own currently-active (non-finished) joined room, same
-- refresh-resilience reason as get_my_hosted_room.
create or replace function public.get_my_joined_room()
returns table(id uuid, code text, game text, status text, config jsonb, student_id uuid)
language sql stable security definer set search_path=public as $fn$
  select r.id, r.code, r.game, r.status, r.config, p.student_id
  from public.game_room_participants p
  join public.game_rooms r on r.id = p.room_id
  where p.student_id = auth.uid() and r.status <> 'finished'
  order by p.joined_at desc limit 1;
$fn$;

-- Joining is only allowed while the room is still 'waiting' -- once the
-- host starts the race, the room is closed to new joiners, matching how
-- a real classroom race works (you can't join after the starting gun).
-- student_name is resolved from the caller's own session, never accepted
-- from the client, the same precedent as submit_wordtris_score.
create or replace function public.join_game_room(p_code text)
returns table(id uuid, game text, status text, config jsonb, student_id uuid)
language plpgsql security definer set search_path=public as $fn$
declare
  target public.game_rooms;
  student_name text;
begin
  select coalesce(nullif(trim(pr.full_name),''),'Student') into student_name
  from public.profiles pr where pr.id = auth.uid();
  if student_name is null then raise exception 'not authorized'; end if;

  select * into target from public.game_rooms gr
  where gr.code = upper(trim(p_code)) and gr.status = 'waiting'
  order by gr.created_at desc limit 1;
  if target.id is null then raise exception 'Room not found, or the race has already started.'; end if;

  -- Real reported bug, live-tested: "column reference student_id is
  -- ambiguous" on every join attempt. This function's own OUT parameter
  -- (returns table(..., student_id uuid)) shadows the plain conflict-
  -- target column LIST "(room_id, student_id)" specifically -- confirmed
  -- empirically (PGlite): the identical insert with no ON CONFLICT
  -- clause at all works fine, and even naming the OUT parameter is fine
  -- on its own; it's specifically the bare column list inside ON
  -- CONFLICT that plpgsql can't disambiguate from its own OUT parameter.
  -- Naming the unique constraint directly (its Postgres-auto-generated
  -- name for `unique(room_id, student_id)` above) sidesteps the column
  -- list entirely -- confirmed this resolves it with no other change.
  insert into public.game_room_participants(room_id, student_id, student_name)
  values (target.id, auth.uid(), student_name)
  on conflict on constraint game_room_participants_room_id_student_id_key
  do update set student_name = excluded.student_name;

  return query select target.id, target.game, target.status, target.config, auth.uid();
end $fn$;

create or replace function public.start_game_room(p_room_id uuid) returns void
language plpgsql security definer set search_path=public as $fn$
begin
  update public.game_rooms set status = 'racing', started_at = now()
  where id = p_room_id and host_id = auth.uid() and status = 'waiting';
  if not found then raise exception 'Room not found, not yours, or already started.'; end if;
end $fn$;

-- Real reported bug: a student who was still mid-passage when the host
-- ended the race showed 0 WPM in the final results, even though their
-- own screen had been showing a real speed (e.g. 19 WPM) right up until
-- the race ended. submit_game_room_result only ever runs when a student
-- actually finishes typing the full passage (or spends their boost) --
-- nothing calls it for someone the host cuts off mid-race, so their row
-- keeps wpm = null, and the results screen's `p.wpm ?? 0` fallback shows
-- a misleadingly precise zero instead of "did not finish". Fixed here,
-- server-side, rather than relying on the student's own tab noticing the
-- room went 'finished' in time (it might not even be open) -- their
-- last-polled live_progress/live_wpm (already being written every ~1-2s
-- by update_game_room_progress) becomes their final result, and the
-- whole room's ranks are recomputed once more so late-finalized students
-- are ranked consistently against everyone who finished normally.
create or replace function public.finish_game_room(p_room_id uuid) returns void
language plpgsql security definer set search_path=public as $fn$
begin
  update public.game_rooms set status = 'finished', finished_at = now()
  where id = p_room_id and host_id = auth.uid() and status <> 'finished';
  if not found then raise exception 'Room not found, not yours, or already finished.'; end if;

  update public.game_room_participants
  set score = live_wpm, wpm = live_wpm, finished_at = now(), updated_at = now()
  where room_id = p_room_id and finished_at is null;

  with ranked as (
    select id, row_number() over (
      order by score desc nulls last, wpm desc nulls last, finished_at asc nulls last
    ) as rn
    from public.game_room_participants
    where room_id = p_room_id
  )
  update public.game_room_participants gp
  set rank = ranked.rn
  from ranked
  where gp.id = ranked.id;
end $fn$;

-- Cheap, frequent (every ~1-2s while racing) live-position update -- only
-- ever touches the caller's own participant row.
create or replace function public.update_game_room_progress(p_room_id uuid, p_progress numeric, p_wpm numeric)
returns void
language plpgsql security definer set search_path=public as $fn$
begin
  update public.game_room_participants
  set live_progress = least(100, greatest(0, coalesce(p_progress, 0))),
      live_wpm = greatest(0, coalesce(p_wpm, 0)),
      updated_at = now()
  where room_id = p_room_id and student_id = auth.uid();
  if not found then raise exception 'not a participant of this room'; end if;
end $fn$;

-- Records this student's final result and recomputes rank for every
-- participant in the room (score desc, then wpm desc, then earliest
-- finish first, ties/not-yet-finished sorted last).
create or replace function public.submit_game_room_result(
  p_room_id uuid, p_score numeric, p_wpm numeric, p_accuracy numeric
) returns void
language plpgsql security definer set search_path=public as $fn$
begin
  update public.game_room_participants
  set score = greatest(0, coalesce(p_score, 0)),
      wpm = greatest(0, coalesce(p_wpm, 0)),
      accuracy = least(100, greatest(0, coalesce(p_accuracy, 0))),
      live_progress = 100,
      finished_at = now(),
      updated_at = now()
  where room_id = p_room_id and student_id = auth.uid();
  if not found then raise exception 'not a participant of this room'; end if;

  with ranked as (
    select id, row_number() over (
      order by score desc nulls last, wpm desc nulls last, finished_at asc nulls last
    ) as rn
    from public.game_room_participants
    where room_id = p_room_id
  )
  update public.game_room_participants gp
  set rank = ranked.rn
  from ranked
  where gp.id = ranked.id;
end $fn$;

-- A student polling their own known room_id needs to detect the
-- 'racing' -> 'finished' transition even after it's finished, which
-- get_my_joined_room() deliberately excludes (that one's for recovering
-- an unknown room_id on page refresh, scoped to non-finished rooms only).
-- Same "host or participant" authorization as list_game_room_participants.
create or replace function public.get_game_room_status(p_room_id uuid)
returns table(status text)
language plpgsql stable security definer set search_path=public as $fn$
begin
  if not exists (
    select 1 from public.game_rooms where id = p_room_id and host_id = auth.uid()
  ) and not exists (
    select 1 from public.game_room_participants where room_id = p_room_id and student_id = auth.uid()
  ) then
    raise exception 'not authorized';
  end if;
  return query select g.status from public.game_rooms g where g.id = p_room_id;
end $fn$;

-- Readable by the room's host or any of its participants -- a plain
-- classroom roster/leaderboard, not sensitive, but still scoped to
-- "people actually in this room" rather than any signed-in user.
create or replace function public.list_game_room_participants(p_room_id uuid)
returns table(
  student_id uuid, student_name text, joined_at timestamptz,
  live_progress numeric, live_wpm numeric, updated_at timestamptz,
  finished_at timestamptz, score numeric, wpm numeric, accuracy numeric, rank int
)
language plpgsql stable security definer set search_path=public as $fn$
begin
  if not exists (
    select 1 from public.game_rooms gr where gr.id = p_room_id and gr.host_id = auth.uid()
  ) and not exists (
    select 1 from public.game_room_participants gp where gp.room_id = p_room_id and gp.student_id = auth.uid()
  ) then
    raise exception 'not authorized';
  end if;
  return query
    select p.student_id, p.student_name, p.joined_at, p.live_progress, p.live_wpm,
      p.updated_at, p.finished_at, p.score, p.wpm, p.accuracy, p.rank
    from public.game_room_participants p
    where p.room_id = p_room_id
    order by p.rank asc nulls last, p.live_progress desc, p.joined_at asc;
end $fn$;

revoke all on function
  public.create_game_room(text,jsonb),
  public.get_my_hosted_room(),
  public.get_my_joined_room(),
  public.join_game_room(text),
  public.start_game_room(uuid),
  public.finish_game_room(uuid),
  public.update_game_room_progress(uuid,numeric,numeric),
  public.submit_game_room_result(uuid,numeric,numeric,numeric),
  public.get_game_room_status(uuid),
  public.list_game_room_participants(uuid)
from public, anon;
grant execute on function
  public.create_game_room(text,jsonb),
  public.get_my_hosted_room(),
  public.get_my_joined_room(),
  public.join_game_room(text),
  public.start_game_room(uuid),
  public.finish_game_room(uuid),
  public.update_game_room_progress(uuid,numeric,numeric),
  public.submit_game_room_result(uuid,numeric,numeric,numeric),
  public.get_game_room_status(uuid),
  public.list_game_room_participants(uuid)
to authenticated;

commit;
