-- The original 50MB dictation-audio cap (bucket, app-level check, and the
-- Server Actions body limit) turned out too tight for real recordings --
-- an admin reported being unable to upload after choosing a real dictation
-- file. Uncompressed/high-quality audio exports (WAV in particular) can
-- run well over 10MB per minute, so even a short recording can exceed
-- 50MB. Raising the bucket's own file_size_limit to 150MB to match the
-- application-level MAX_AUDIO_BYTES change (app/admin/tests/actions.ts)
-- and next.config.ts's Server Actions bodySizeLimit.
update storage.buckets set file_size_limit = 157286400 where id = 'stenography-audio';
