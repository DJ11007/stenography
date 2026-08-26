begin;

-- Per-test admin capability configuration is removed from the product:
-- students always get full editor access now, and the admin authoring form
-- no longer exposes a capability checklist (every new test version is saved
-- with public.word_efficiency_default_editor_capabilities()). This also
-- permanently forecloses the whole class of "Disabled capability changed
-- document feature X" false-positive autosave failures for any measurement
-- field (marginRight, hyphens, ...) that never had a dedicated command --
-- once every command is enabled, assert_word_efficiency_capability_changes
-- can never find a disabled command blocking a detected change.
-- Existing, already-published test versions are updated in place so
-- students do not need an admin to re-save every test to get full access.
update public.word_efficiency_versions set editor_capabilities=public.word_efficiency_default_editor_capabilities();

commit;
