begin;

-- Real requested feature: a student could upload their own TEXT passage for
-- custom practice (My Matters), including a "Stenography" mode, but that
-- mode never actually played real dictation audio -- preset.audioUrl (the
-- one thing that turns on the DictationGate flow in ConfigurableTypingExam)
-- was never set for a My Matter, so "Stenography" just meant a plain typed
-- copy of the passage was shown, not a real dictation. This lets a student
-- upload their own audio file too, reusing the exact same stenography-audio
-- bucket and the existing /typing/stenography-audio/[...path] proxy route
-- admin-authored dictations already use -- no new bucket, no new route.
--
-- Admin's own objects in this bucket live at "<test-id>/<file>" (test UUIDs);
-- a student's own objects live at "<their auth.uid()>/<file>" instead, so
-- this new policy can be scoped to exactly their own folder without ever
-- overlapping an admin path, purely additive to the two existing policies
-- from 202608270034 (storage.objects RLS policies combine permissively).
drop policy if exists "Students manage their own dictation audio" on storage.objects;
create policy "Students manage their own dictation audio" on storage.objects for all to authenticated
  using (bucket_id = 'stenography-audio' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'stenography-audio' and (storage.foldername(name))[1] = auth.uid()::text);

commit;
