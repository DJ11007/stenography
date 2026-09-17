begin;

-- WordTris: an original falling-word typing game (/typing/games/wordtris),
-- for both Hindi and English. Same shape as krutidev_tutor_exercises: a
-- plain table reachable only through security-definer RPCs (RLS on, no
-- policies), is_aal2_admin()-gated writes, and a bundled-defaults fallback
-- in lib/wordtris-content.ts for when this table is empty.
--
-- Hindi words are stored in Unicode (readable/reviewable); the game
-- converts to keyboard-typeable Kruti Dev bytes with toTypeableKrutiDev at
-- render time, exactly as the Kruti Dev tutor does.

create table if not exists public.wordtris_word_banks(
  id uuid primary key default gen_random_uuid(),
  language text not null check (language in ('hindi','english')),
  category text not null check (category in ('animals','cars','common','countries','easy_words','names','numbers')),
  word text not null,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
alter table public.wordtris_word_banks enable row level security;
create index if not exists wordtris_word_banks_listing
  on public.wordtris_word_banks(is_published, language, category);

create or replace function public.list_published_wordtris_words(p_language text, p_category text)
returns setof public.wordtris_word_banks
language sql stable security definer set search_path=public as $fn$
  select * from public.wordtris_word_banks
  where is_published and language=p_language and category=p_category
  order by word;
$fn$;

create or replace function public.admin_list_wordtris_words()
returns setof public.wordtris_word_banks
language plpgsql stable security definer set search_path=public as $fn$
begin
  if not public.is_aal2_admin() then raise exception 'not authorized'; end if;
  return query select * from public.wordtris_word_banks order by language, category, word;
end $fn$;

create or replace function public.admin_save_wordtris_word(
  p_id uuid, p_language text, p_category text, p_word text, p_is_published boolean
) returns public.wordtris_word_banks
language plpgsql security definer set search_path=public as $fn$
declare row public.wordtris_word_banks;
begin
  if not public.is_aal2_admin() then raise exception 'not authorized'; end if;
  if p_language not in ('hindi','english') then raise exception 'Invalid language.'; end if;
  if p_category not in ('animals','cars','common','countries','easy_words','names','numbers') then raise exception 'Invalid category.'; end if;
  if trim(coalesce(p_word,'')) = '' then raise exception 'Word is required.'; end if;
  if p_id is null then
    insert into public.wordtris_word_banks(language,category,word,is_published,created_by)
    values(p_language, p_category, trim(p_word), coalesce(p_is_published,true), auth.uid())
    returning * into row;
  else
    update public.wordtris_word_banks set
      language=p_language, category=p_category, word=trim(p_word),
      is_published=coalesce(p_is_published,true), updated_at=now()
    where id=p_id returning * into row;
    if row.id is null then raise exception 'Word not found.'; end if;
  end if;
  return row;
end $fn$;

create or replace function public.admin_delete_wordtris_word(p_id uuid) returns void
language plpgsql security definer set search_path=public as $fn$
begin
  if not public.is_aal2_admin() then raise exception 'not authorized'; end if;
  delete from public.wordtris_word_banks where id=p_id;
end $fn$;

grant execute on function public.list_published_wordtris_words(text,text) to authenticated;
revoke all on function public.admin_list_wordtris_words(),
  public.admin_save_wordtris_word(uuid,text,text,text,boolean),
  public.admin_delete_wordtris_word(uuid) from public, anon;
grant execute on function public.admin_list_wordtris_words(),
  public.admin_save_wordtris_word(uuid,text,text,text,boolean),
  public.admin_delete_wordtris_word(uuid) to authenticated;

-- Capped leaderboard, scoped per (language, category) -- Easy Words and
-- Countries award different points per word, so scores are never compared
-- across categories. Real names are shown (per the reference the admin
-- asked to match), so both RPCs are restricted to signed-in students, not
-- anon, unlike the site's other, deliberately-anonymized live-results
-- ticker (published_live_results).
create table if not exists public.wordtris_scores(
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.profiles(id),
  student_name text not null,
  language text not null check (language in ('hindi','english')),
  category text not null check (category in ('animals','cars','common','countries','easy_words','names','numbers')),
  score integer not null,
  words_caught integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.wordtris_scores enable row level security;
create index if not exists wordtris_scores_ranking
  on public.wordtris_scores(language, category, score desc);

-- Inserts the student's score, then trims that (language, category) group
-- back down to the top 50 by score -- the lowest-scoring rows are evicted
-- once a group would otherwise exceed 50. student_id/student_name are
-- resolved from the caller's own session, never accepted from the client,
-- the same "never trust the client's own number" precedent as
-- recordManagedAttempt (app/tests/actions.ts).
create or replace function public.submit_wordtris_score(
  p_language text, p_category text, p_score integer, p_words_caught integer
) returns public.wordtris_scores
language plpgsql security definer set search_path=public as $fn$
declare
  row public.wordtris_scores;
  student_name text;
begin
  if p_language not in ('hindi','english') then raise exception 'Invalid language.'; end if;
  if p_category not in ('animals','cars','common','countries','easy_words','names','numbers') then raise exception 'Invalid category.'; end if;
  if p_score is null or p_score < 0 then raise exception 'Invalid score.'; end if;
  select coalesce(nullif(trim(full_name),''),'Student') into student_name from public.profiles where id=auth.uid();
  if student_name is null then raise exception 'not authorized'; end if;

  insert into public.wordtris_scores(student_id, student_name, language, category, score, words_caught)
  values(auth.uid(), student_name, p_language, p_category, p_score, coalesce(p_words_caught,0))
  returning * into row;

  delete from public.wordtris_scores
  where language=p_language and category=p_category
    and id not in (
      select id from public.wordtris_scores
      where language=p_language and category=p_category
      order by score desc, created_at asc
      limit 50
    );

  return row;
end $fn$;

create or replace function public.wordtris_leaderboard(p_language text, p_category text, p_limit integer default 10)
returns setof public.wordtris_scores
language sql stable security definer set search_path=public as $fn$
  select * from public.wordtris_scores
  where language=p_language and category=p_category
  order by score desc, created_at asc
  limit least(greatest(coalesce(p_limit,10),1),50);
$fn$;

revoke all on function public.submit_wordtris_score(text,text,integer,integer),
  public.wordtris_leaderboard(text,text,integer) from public, anon;
grant execute on function public.submit_wordtris_score(text,text,integer,integer),
  public.wordtris_leaderboard(text,text,integer) to authenticated;

-- Seed a starter word bank per category x language so the admin has real
-- content to edit and the game is playable before any admin edits happen.
do $seed$
begin
  if not exists (select 1 from public.wordtris_word_banks) then
    insert into public.wordtris_word_banks (language, category, word) values
      ('english','animals','cat'),('english','animals','dog'),('english','animals','lion'),('english','animals','tiger'),('english','animals','horse'),
      ('english','animals','sheep'),('english','animals','goat'),('english','animals','rabbit'),('english','animals','monkey'),('english','animals','elephant'),
      ('english','animals','giraffe'),('english','animals','zebra'),('english','animals','panda'),('english','animals','wolf'),('english','animals','eagle'),
      ('english','cars','car'),('english','cars','bus'),('english','cars','train'),('english','cars','truck'),('english','cars','bike'),
      ('english','cars','jeep'),('english','cars','taxi'),('english','cars','scooter'),('english','cars','tractor'),('english','cars','van'),
      ('english','cars','wagon'),('english','cars','sedan'),('english','cars','coupe'),('english','cars','pickup'),('english','cars','trailer'),
      ('english','common','the'),('english','common','and'),('english','common','for'),('english','common','are'),('english','common','but'),
      ('english','common','not'),('english','common','you'),('english','common','all'),('english','common','can'),('english','common','had'),
      ('english','common','her'),('english','common','was'),('english','common','one'),('english','common','our'),('english','common','out'),
      ('english','countries','india'),('english','countries','china'),('english','countries','japan'),('english','countries','france'),('english','countries','brazil'),
      ('english','countries','canada'),('english','countries','russia'),('english','countries','germany'),('english','countries','mexico'),('english','countries','egypt'),
      ('english','countries','kenya'),('english','countries','spain'),('english','countries','italy'),('english','countries','nepal'),('english','countries','bhutan'),
      ('english','easy_words','cat'),('english','easy_words','dog'),('english','easy_words','sun'),('english','easy_words','run'),('english','easy_words','big'),
      ('english','easy_words','red'),('english','easy_words','hat'),('english','easy_words','box'),('english','easy_words','cup'),('english','easy_words','pen'),
      ('english','easy_words','map'),('english','easy_words','top'),('english','easy_words','bed'),('english','easy_words','fan'),('english','easy_words','key'),
      ('english','names','john'),('english','names','mary'),('english','names','peter'),('english','names','priya'),('english','names','ravi'),
      ('english','names','sunil'),('english','names','anita'),('english','names','rahul'),('english','names','sonia'),('english','names','aman'),
      ('english','names','neha'),('english','names','vikas'),('english','names','pooja'),('english','names','arjun'),('english','names','meera'),
      ('english','numbers','one'),('english','numbers','two'),('english','numbers','three'),('english','numbers','four'),('english','numbers','five'),
      ('english','numbers','six'),('english','numbers','seven'),('english','numbers','eight'),('english','numbers','nine'),('english','numbers','ten'),
      ('english','numbers','eleven'),('english','numbers','twelve'),('english','numbers','twenty'),('english','numbers','thirty'),('english','numbers','hundred'),
      ('hindi','animals','बिल्ली'),('hindi','animals','कुत्ता'),('hindi','animals','शेर'),('hindi','animals','बाघ'),('hindi','animals','घोड़ा'),
      ('hindi','animals','भेड़'),('hindi','animals','बकरी'),('hindi','animals','खरगोश'),('hindi','animals','बंदर'),('hindi','animals','हाथी'),
      ('hindi','animals','जिराफ़'),('hindi','animals','ज़ेबरा'),('hindi','animals','भालू'),('hindi','animals','भेड़िया'),('hindi','animals','चील'),
      ('hindi','cars','कार'),('hindi','cars','बस'),('hindi','cars','ट्रेन'),('hindi','cars','ट्रक'),('hindi','cars','बाइक'),
      ('hindi','cars','जीप'),('hindi','cars','टैक्सी'),('hindi','cars','स्कूटर'),('hindi','cars','ट्रैक्टर'),('hindi','cars','वैन'),
      ('hindi','cars','ठेला'),('hindi','cars','साइकिल'),('hindi','cars','रिक्शा'),('hindi','cars','वैगन'),('hindi','cars','ट्रॉली'),
      ('hindi','common','और'),('hindi','common','के'),('hindi','common','का'),('hindi','common','है'),('hindi','common','में'),
      ('hindi','common','को'),('hindi','common','से'),('hindi','common','यह'),('hindi','common','वह'),('hindi','common','हैं'),
      ('hindi','common','पर'),('hindi','common','कि'),('hindi','common','ने'),('hindi','common','तो'),('hindi','common','भी'),
      ('hindi','countries','भारत'),('hindi','countries','चीन'),('hindi','countries','जापान'),('hindi','countries','फ्रांस'),('hindi','countries','ब्राज़ील'),
      ('hindi','countries','कनाडा'),('hindi','countries','रूस'),('hindi','countries','जर्मनी'),('hindi','countries','मेक्सिको'),('hindi','countries','मिस्र'),
      ('hindi','countries','केन्या'),('hindi','countries','स्पेन'),('hindi','countries','इटली'),('hindi','countries','नेपाल'),('hindi','countries','भूटान'),
      ('hindi','easy_words','घर'),('hindi','easy_words','कल'),('hindi','easy_words','अब'),('hindi','easy_words','यह'),('hindi','easy_words','वह'),
      ('hindi','easy_words','कर'),('hindi','easy_words','जल'),('hindi','easy_words','फल'),('hindi','easy_words','नल'),('hindi','easy_words','कम'),
      ('hindi','easy_words','दम'),('hindi','easy_words','रख'),('hindi','easy_words','चल'),('hindi','easy_words','बस'),('hindi','easy_words','गम'),
      ('hindi','names','राम'),('hindi','names','श्याम'),('hindi','names','गीता'),('hindi','names','सीता'),('hindi','names','राहुल'),
      ('hindi','names','प्रिया'),('hindi','names','सुनील'),('hindi','names','अनीता'),('hindi','names','विकास'),('hindi','names','पूजा'),
      ('hindi','names','अर्जुन'),('hindi','names','मीरा'),('hindi','names','अमन'),('hindi','names','नेहा'),('hindi','names','सोनिया'),
      ('hindi','numbers','एक'),('hindi','numbers','दो'),('hindi','numbers','तीन'),('hindi','numbers','चार'),('hindi','numbers','पांच'),
      ('hindi','numbers','छह'),('hindi','numbers','सात'),('hindi','numbers','आठ'),('hindi','numbers','नौ'),('hindi','numbers','दस'),
      ('hindi','numbers','ग्यारह'),('hindi','numbers','बारह'),('hindi','numbers','बीस'),('hindi','numbers','तीस'),('hindi','numbers','सौ');
  end if;
end $seed$;

commit;
