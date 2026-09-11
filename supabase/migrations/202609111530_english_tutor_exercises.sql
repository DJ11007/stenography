begin;

-- Admin-editable content for the English learn simulator
-- (/typing/learn/english-tutor): its three practice tabs -- key drills,
-- word sets and paragraphs. Same shape as krutidev_tutor_exercises
-- (202609101600) -- a plain table reachable only through security-definer
-- RPCs (RLS on, no policies), an anon read for the tutor page and
-- is_aal2_admin()-gated writes. No font-encoding step: content is typed
-- exactly as authored. key-lesson content is one drill line per newline;
-- word-set content is space-separated words; paragraph content is the
-- passage. lib/english-tutor-content.ts stays as the fallback for when
-- this table is empty.

create table if not exists public.english_tutor_exercises(
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('key-lesson','word-set','paragraph')),
  title text not null,
  content text not null default '',
  focus_keys text,
  is_published boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
alter table public.english_tutor_exercises enable row level security;
create index if not exists english_tutor_exercises_listing
  on public.english_tutor_exercises(is_published, kind, display_order, created_at);

create or replace function public.list_published_english_tutor_exercises()
returns setof public.english_tutor_exercises
language sql stable security definer set search_path=public as $fn$
  select * from public.english_tutor_exercises where is_published
  order by kind, display_order, created_at;
$fn$;

create or replace function public.admin_list_english_tutor_exercises()
returns setof public.english_tutor_exercises
language plpgsql stable security definer set search_path=public as $fn$
begin
  if not public.is_aal2_admin() then raise exception 'not authorized'; end if;
  return query select * from public.english_tutor_exercises order by kind, display_order, created_at;
end $fn$;

create or replace function public.admin_save_english_tutor_exercise(
  p_id uuid, p_kind text, p_title text, p_content text, p_focus_keys text,
  p_is_published boolean, p_display_order integer
) returns public.english_tutor_exercises
language plpgsql security definer set search_path=public as $fn$
declare row public.english_tutor_exercises;
begin
  if not public.is_aal2_admin() then raise exception 'not authorized'; end if;
  if p_kind not in ('key-lesson','word-set','paragraph') then raise exception 'Invalid exercise type.'; end if;
  if trim(coalesce(p_title,'')) = '' then raise exception 'Title is required.'; end if;
  if trim(coalesce(p_content,'')) = '' then raise exception 'Content is required.'; end if;
  if p_id is null then
    insert into public.english_tutor_exercises(kind,title,content,focus_keys,is_published,display_order,created_by)
    values(p_kind, p_title, p_content, nullif(trim(coalesce(p_focus_keys,'')),''),
           coalesce(p_is_published,true), coalesce(p_display_order,0), auth.uid())
    returning * into row;
  else
    update public.english_tutor_exercises set
      kind=p_kind, title=p_title, content=p_content,
      focus_keys=nullif(trim(coalesce(p_focus_keys,'')),''),
      is_published=coalesce(p_is_published,true), display_order=coalesce(p_display_order,0), updated_at=now()
    where id=p_id returning * into row;
    if row.id is null then raise exception 'Exercise not found.'; end if;
  end if;
  return row;
end $fn$;

create or replace function public.admin_delete_english_tutor_exercise(p_id uuid) returns void
language plpgsql security definer set search_path=public as $fn$
begin
  if not public.is_aal2_admin() then raise exception 'not authorized'; end if;
  delete from public.english_tutor_exercises where id=p_id;
end $fn$;

grant execute on function public.list_published_english_tutor_exercises() to anon, authenticated;
revoke all on function public.admin_list_english_tutor_exercises(),
  public.admin_save_english_tutor_exercise(uuid,text,text,text,text,boolean,integer),
  public.admin_delete_english_tutor_exercise(uuid) from public, anon;
grant execute on function public.admin_list_english_tutor_exercises(),
  public.admin_save_english_tutor_exercise(uuid,text,text,text,text,boolean,integer),
  public.admin_delete_english_tutor_exercise(uuid) to authenticated;

-- Seed the current bundled curriculum so the admin has real content to edit.
do $seed$
begin
  if not exists (select 1 from public.english_tutor_exercises) then
    insert into public.english_tutor_exercises (kind, title, content, focus_keys, display_order) values
      ('key-lesson', 'Lesson 1 — Home Row (a s d f j k l ;)', E'asdf jkl; asdf jkl;
aa ss dd ff jj kk ll ;;
a lass falls; ask dad; a sad fall', 'a s d f j k l ;', 0),
      ('key-lesson', 'Lesson 2 — e i', E'ei ie ei ie
kid lake idea sail
a sad idea; a silk desk; side lake', 'e i', 1),
      ('key-lesson', 'Lesson 3 — r u', E'ur ru ur ru
surf jury dark risk
a dark jar; a full jug; a rude risk', 'r u', 2),
      ('key-lesson', 'Lesson 4 — t y', E'ty yt ty yt
tray style dusty
a tidy list; try it; a rusty tray', 't y', 3),
      ('key-lesson', 'Lesson 5 — g h', E'gh hg gh hg
high light flash
a light gas; he has it; a huge flash', 'g h', 4),
      ('key-lesson', 'Lesson 6 — Shift & Capitals', E'Asdf Jkl; Lisa Dad
Ali Sara Delhi Kids
Sara said Hi to Dad; Ask Dad First', 'Shift', 5),
      ('key-lesson', 'Lesson 7 — o w', E'ow wo ow wo
world tower slow
a low tower; grow slow; a wide world', 'o w', 6),
      ('key-lesson', 'Lesson 8 — n ,', E'n, ,n n, ,n
not, run, sun,
I run, you walk, we win, they lose.', 'n ,', 7),
      ('key-lesson', 'Lesson 9 — q p', E'qp pq qp pq
quiet paper quick
a quiet park; type quick; a proud queen', 'q p', 8),
      ('key-lesson', 'Lesson 10 — c v', E'cv vc cv vc
voice cave clever
a clever voice; save it; a vivid view', 'c v', 9),
      ('key-lesson', 'Lesson 11 — m b', E'mb bm mb bm
number combat problem
a big number; blame him; a brave member', 'm b', 10),
      ('key-lesson', 'Lesson 12 — z x', E'zx xz zx xz
size fix zebra exact
fix the size; a lazy fox; an exact zone', 'z x', 11),
      ('key-lesson', 'Lesson 13 — Number Row (1 2 3 4 5 6 7 8 9 0)', E'12 34 56 78 90
2024 100 75 500
Room 12, Page 45, Item 908, Year 2026', '1 2 3 4 5 6 7 8 9 0', 12),
      ('key-lesson', 'Lesson 14 — Punctuation ( . , '' " )', E'. , '' " . , '' "
It''s fine, he said.
"Stop!" she said. It''s done, finally.', '. , '' "', 13),
      ('key-lesson', 'Lesson 15 — Full-Alphabet Combos', E'the quick brown fox
jumps over the lazy dog
pack my box with five dozen liquor jugs', 'a z', 14),
      ('key-lesson', 'Lesson 16 — Sentence Practice', E'Practice makes a person perfect.
Success depends on hard work and patience.
Typing speed improves with daily, focused practice.', 'a z 0 9', 15),
      ('word-set', 'Word Set 1 — Basic Words', 'cat dog sun run walk talk book desk lamp door wall floor chair table window', null, 16),
      ('word-set', 'Word Set 2 — Common Verbs', 'read write speak listen learn teach help share care grow build create solve plan', null, 17),
      ('word-set', 'Word Set 3 — Numbers & Time', 'today tomorrow morning evening night week month year hour minute second soon later now', null, 18),
      ('word-set', 'Word Set 4 — Office Vocabulary', 'letter file report meeting agenda memo email schedule deadline manager office document signature', null, 19),
      ('word-set', 'Word Set 5 — Education', 'student teacher school college exam result subject syllabus lecture library classroom homework project grade', null, 20),
      ('word-set', 'Word Set 6 — Nature', 'river mountain ocean forest desert valley island cloud storm breeze sunrise sunset season climate', null, 21),
      ('word-set', 'Word Set 7 — Society & Nation', 'nation citizen society culture tradition freedom justice equality unity government constitution democracy duty right', null, 22),
      ('word-set', 'Word Set 8 — Emotions & Qualities', 'honesty courage patience kindness confidence discipline respect gratitude humility wisdom strength hope trust care', null, 23),
      ('word-set', 'Word Set 9 — Technology', 'computer internet software keyboard mouse monitor printer network password website server database application system update', null, 24),
      ('word-set', 'Word Set 10 — Business', 'company market product customer service quality price profit budget strategy growth investment brand target', null, 25),
      ('word-set', 'Word Set 11 — Health', 'exercise nutrition sleep hydration wellness fitness balance hygiene checkup vaccine therapy recovery immunity strength', null, 26),
      ('word-set', 'Word Set 12 — Mixed Advanced Words', 'responsibility achievement opportunity knowledge experience communication organization environment development technology infrastructure innovation efficiency productivity', null, 27),
      ('paragraph', 'Paragraph 1 — Introduction', 'English typing is one of the most useful skills for any student or working professional today. Almost every job, from government offices to private companies, expects basic computer and typing knowledge. Anyone who practises regularly can reach a good typing speed within a few weeks. The first rule of fast typing is always pressing the correct key with the correct finger.', null, 28),
      ('paragraph', 'Paragraph 2 — The Importance of Practice', 'Learning any skill requires patience and consistent practice, and typing is no exception. In the beginning, speed stays low and mistakes happen often, but there is no need to worry. Practising for even thirty minutes every day helps the fingers slowly memorise the position of each key. Over time, typing without looking at the keyboard becomes completely natural.', null, 29),
      ('paragraph', 'Paragraph 3 — Accuracy Comes First', 'While learning to type, accuracy should always matter more than raw speed. If you build the habit of pressing the right key from the very start, speed automatically improves on its own. A mistake repeated again and again slowly turns into a habit that becomes hard to correct later. So type every single word carefully and correctly, right from the first lesson.', null, 30),
      ('paragraph', 'Paragraph 4 — A Formal Office Letter', 'To, The Branch Manager, Samradhi Classes. Subject: Request to start a typing training programme. Sir, I would like to bring to your notice that many employees in our department face difficulty typing quickly and accurately in English. I therefore request that a short training programme be organised so that every staff member can type with better speed and accuracy.', null, 31),
      ('paragraph', 'Paragraph 5 — News Style', 'The state government announced today that all government offices will gradually shift most of their routine work to computers over the coming year. Officials said that employees would receive special training and that the necessary equipment would be provided at every office. Authorities believe this step will make government services faster and more convenient for ordinary citizens.', null, 32),
      ('paragraph', 'Paragraph 6 — Motivation', 'Success always belongs to those who are not afraid of hard work and steady effort. Obstacles along the way are not meant to stop us; they exist to make us stronger and more capable. People who never give up and keep trying, no matter how many times they fail, eventually reach their goal. Stay confident in your own ability and keep moving forward every single day.', null, 33),
      ('paragraph', 'Paragraph 7 — Technology and the Future', 'We are living in the age of information and rapid technology. Countries that adopt new technology quickly tend to develop and grow much faster than others. It has become essential to build strong knowledge of science, mathematics and computers so that every student can understand new subjects with confidence. Typing is simply the first small step on that much larger journey.', null, 34),
      ('paragraph', 'Paragraph 8 — Extended Practice', 'Becoming a genuinely good typist requires correct posture, a straight back, and eyes that stay fixed on the screen rather than the keyboard. Looking down at the keys again and again slows down your overall speed considerably. It feels difficult in the beginning, but after a few days of regular, focused practice the fingers begin finding the right keys almost by themselves. Practising new words and new paragraphs every single day steadily builds vocabulary as well as genuine self-confidence. This same quiet consistency is exactly what turns an ordinary beginner into a genuinely skilled and dependable typist over time.', null, 35);
  end if;
end $seed$;

commit;
