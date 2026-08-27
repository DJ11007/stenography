-- Real audio dictation for stenography tests. The audio file's storage path is stored inside
-- the existing test_versions.configuration jsonb payload (as "audio_path") — no new column is
-- needed there since save_managed_test already persists the full admin payload verbatim.
-- This migration only adds the storage bucket and its access policies.

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('stenography-audio','stenography-audio',false,52428800,array['audio/mpeg','audio/mp3','audio/wav','audio/ogg','audio/mp4','audio/x-m4a','audio/webm'])
on conflict(id) do update set public=false,file_size_limit=52428800,allowed_mime_types=array['audio/mpeg','audio/mp3','audio/wav','audio/ogg','audio/mp4','audio/x-m4a','audio/webm'];

drop policy if exists "AAL2 admins manage stenography audio" on storage.objects;
create policy "AAL2 admins manage stenography audio" on storage.objects for all to authenticated
  using(bucket_id='stenography-audio' and public.is_aal2_admin())
  with check(bucket_id='stenography-audio' and public.is_aal2_admin());

drop policy if exists "Students read published stenography audio" on storage.objects;
create policy "Students read published stenography audio" on storage.objects for select to authenticated
  using(
    bucket_id='stenography-audio' and exists(
      select 1 from public.test_versions v
      join public.tests t on t.id=v.test_id and t.current_version_id=v.id
      where v.configuration->>'audio_path'=storage.objects.name
        and t.status='published' and t.visibility='public' and t.mode='stenography'
    )
  );
