begin;

-- Root cause of "Autosave failed: Document run fields are invalid":
--
-- assert_word_efficiency_document_schema (the RPC-level validator called by
-- autosave_word_efficiency_document/submit_word_efficiency_document) strips
-- every run field newer than migration 202608240011 in its own layer before
-- delegating further down the wrap-and-neutralize chain, so by the time
-- execution reaches assert_word_efficiency_underline_styles at the bottom
-- it only ever sees the old, narrower field set -- this part was already
-- verified correct.
--
-- BUT assert_word_efficiency_underline_styles is *also* called directly,
-- completely outside that RPC chain, by the validate_word_efficiency_underline_write
-- trigger (before update of document_autosave, final_document_snapshot on
-- word_efficiency_attempts) -- and that trigger passes the RAW document
-- straight through with none of the newer-field stripping the RPC layers do.
-- Since migration 202608240011, this function's run-field whitelist was
-- never extended for smallCaps/allCaps/hidden (202608280040) or
-- charScale/charSpacing/charPosition/kerningEnabled/kerningMin
-- (202608310043) -- so ANY autosave or submit of a document containing a
-- run with one of those fields set has been failing this trigger with
-- "Document run fields are invalid" ever since those features shipped,
-- independent of whatever the RPC-level validator decided. Reproduced live
-- against the pre-migration function: a run with smallCaps:true fails with
-- exactly this error message.
--
-- Fix: this function has always been fully redefined (never renamed into a
-- _before_X wrapper), so it's redefined again here with its run-field
-- whitelist brought in line with RUN_V2 in lib/word-editor-document.ts --
-- every field ever added since 202608240011. Everything else in the
-- function (the actual underline-metadata validation) is unchanged.
create or replace function public.assert_word_efficiency_underline_styles(document_snapshot jsonb)
returns void language plpgsql immutable set search_path=pg_catalog,public as $$
declare run_value jsonb;
begin
 if document_snapshot is null or jsonb_typeof(document_snapshot)<>'object' then raise exception 'Invalid structured document snapshot';end if;
 for run_value in select run_rows.run_value from jsonb_array_elements(coalesce(document_snapshot->'blocks','[]'::jsonb))as block_rows(block_value)cross join lateral jsonb_array_elements(coalesce(block_rows.block_value->'runs','[]'::jsonb))as run_rows(run_value)loop
  if exists(select 1 from jsonb_object_keys(run_value)as run_keys(key_name)where run_keys.key_name not in('text','bold','italic','underline','underlineStyle','underlineColor','underlineThickness','underlineWordsOnly','strike','superscript','subscript','fontFamily','fontSize','color','highlight','doubleStrike','href','bookmark','field','smallCaps','allCaps','hidden','charScale','charSpacing','charPosition','kerningEnabled','kerningMin'))then raise exception 'Document run fields are invalid';end if;
  if run_value?'underlineStyle'and(run_value->'underlineStyle'<>'null'::jsonb and(jsonb_typeof(run_value->'underlineStyle')<>'string'or run_value->>'underlineStyle'not in('single','double','thick','dotted','dashed','dot-dash','dot-dot-dash','wavy','words-only')))then raise exception 'Invalid underline style';end if;
  if run_value?'underlineColor'and(run_value->'underlineColor'<>'null'::jsonb and(jsonb_typeof(run_value->'underlineColor')<>'string'or run_value->>'underlineColor'!~'^[0-9A-Fa-f]{6}$'))then raise exception 'Invalid underline color';end if;
  if run_value?'underlineThickness'and(run_value->'underlineThickness'<>'null'::jsonb and(jsonb_typeof(run_value->'underlineThickness')<>'number'or(run_value->>'underlineThickness')::numeric not between 1 and 5))then raise exception 'Invalid underline thickness';end if;
  if run_value?'underlineWordsOnly'and jsonb_typeof(run_value->'underlineWordsOnly')<>'boolean'then raise exception 'Invalid words-only underline setting';end if;
  if run_value?'smallCaps'and jsonb_typeof(run_value->'smallCaps')<>'boolean'then raise exception 'Invalid run mark';end if;
  if run_value?'allCaps'and jsonb_typeof(run_value->'allCaps')<>'boolean'then raise exception 'Invalid run mark';end if;
  if run_value?'hidden'and jsonb_typeof(run_value->'hidden')<>'boolean'then raise exception 'Invalid run mark';end if;
  if run_value?'charScale'and(run_value->'charScale'<>'null'::jsonb and jsonb_typeof(run_value->'charScale')<>'number')then raise exception 'Invalid character scale';end if;
  if run_value?'charSpacing'and(run_value->'charSpacing'<>'null'::jsonb and jsonb_typeof(run_value->'charSpacing')<>'number')then raise exception 'Invalid character spacing';end if;
  if run_value?'charPosition'and(run_value->'charPosition'<>'null'::jsonb and jsonb_typeof(run_value->'charPosition')<>'number')then raise exception 'Invalid character position';end if;
  if run_value?'kerningEnabled'and jsonb_typeof(run_value->'kerningEnabled')<>'boolean'then raise exception 'Invalid kerning setting';end if;
  if run_value?'kerningMin'and(run_value->'kerningMin'<>'null'::jsonb and jsonb_typeof(run_value->'kerningMin')<>'number')then raise exception 'Invalid kerning minimum';end if;
  if coalesce((run_value->>'underline')::boolean,false)=false and(
   coalesce(run_value->'underlineStyle','null'::jsonb)<>'null'::jsonb or
   coalesce(run_value->'underlineColor','null'::jsonb)<>'null'::jsonb or
   coalesce(run_value->'underlineThickness','null'::jsonb)<>'null'::jsonb or
   coalesce((run_value->>'underlineWordsOnly')::boolean,false)
  )then raise exception 'Underline metadata requires underline';end if;
 end loop;
end$$;

commit;
