-- Word Efficiency: a paragraph may have up to 5000 runs (was 500).
--
-- Formatting the words of a paragraph but not its spaces (Find ^$ > Find In > Highlight, as the
-- exam asks for "entire words ... not all the text") gives one run per word and per space. A long
-- paragraph done that way exceeded 500 runs and the exam could not be submitted ("Invalid structured
-- document block"), even at time-up. The editor now also joins neighbouring runs with the same
-- formatting; the per-document limits are unchanged.
--
-- Only the run-count check in the existing function is changed (edited in place, so the rest of
-- the function stays exactly as it is). Idempotent.
begin;

do $migration$
declare
  definition text;
begin
  select pg_get_functiondef(p.oid) into definition
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'assert_word_efficiency_document_schema_before_underline_styles';
  if definition is null then
    raise notice 'assert_word_efficiency_document_schema_before_underline_styles not found; nothing to change';
  elsif position('jsonb_array_length(block_value->''runs'')not between 1 and 500' in definition) > 0 then
    execute replace(definition, 'jsonb_array_length(block_value->''runs'')not between 1 and 500', 'jsonb_array_length(block_value->''runs'')not between 1 and 5000');
  end if;
end
$migration$;

commit;
