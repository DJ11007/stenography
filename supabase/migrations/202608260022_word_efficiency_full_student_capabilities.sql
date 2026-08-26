begin;

-- Migration 020 gave every TEST VERSION full editor capabilities, but each
-- in-progress ATTEMPT caches its own copy of editor_capabilities inside
-- word_efficiency_attempts.snapshot at prepare time (see
-- initialize_word_efficiency_document). Attempts started before migration
-- 020 are still bound to whatever restricted set was cached then, so a
-- student mid-attempt could use a command the client-side
-- validateWordEditorOperations check (lib/word-editor-document.ts) still
-- considers disabled for THIS attempt, blocking autosave/submit with
-- "Editor command X is disabled for this test version." even though the
-- test itself now grants full access. Backfill the cached snapshot on every
-- attempt that has not been submitted yet so in-progress attempts pick up
-- full access immediately; submitted/completed attempts are left untouched
-- since their snapshot is part of the immutable historical record.
update public.word_efficiency_attempts
set snapshot = jsonb_set(snapshot, '{editor_capabilities}', public.word_efficiency_default_editor_capabilities())
where snapshot ? 'editor_capabilities' and status not in ('submitted','completed');

commit;
