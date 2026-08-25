begin;

-- Additive validation for structured underline metadata. Historical boolean-only
-- runs remain valid and no stored version or attempt is rewritten.
alter function public.assert_word_efficiency_document_schema(jsonb,jsonb)
 rename to assert_word_efficiency_document_schema_before_underline_styles;

create or replace function public.assert_word_efficiency_underline_styles(document_snapshot jsonb)
returns void language plpgsql immutable set search_path=pg_catalog,public as $$
declare run_value jsonb;
begin
 if document_snapshot is null or jsonb_typeof(document_snapshot)<>'object' then raise exception 'Invalid structured document snapshot';end if;
 for run_value in select run_rows.run_value from jsonb_array_elements(coalesce(document_snapshot->'blocks','[]'::jsonb))as block_rows(block_value)cross join lateral jsonb_array_elements(coalesce(block_rows.block_value->'runs','[]'::jsonb))as run_rows(run_value)loop
  if exists(select 1 from jsonb_object_keys(run_value)as run_keys(key_name)where run_keys.key_name not in('text','bold','italic','underline','underlineStyle','underlineColor','underlineThickness','underlineWordsOnly','strike','superscript','subscript','fontFamily','fontSize','color','highlight','doubleStrike','href','bookmark','field'))then raise exception 'Document run fields are invalid';end if;
  if run_value?'underlineStyle'and(run_value->'underlineStyle'<>'null'::jsonb and(jsonb_typeof(run_value->'underlineStyle')<>'string'or run_value->>'underlineStyle'not in('single','double','thick','dotted','dashed','dot-dash','dot-dot-dash','wavy','words-only')))then raise exception 'Invalid underline style';end if;
  if run_value?'underlineColor'and(run_value->'underlineColor'<>'null'::jsonb and(jsonb_typeof(run_value->'underlineColor')<>'string'or run_value->>'underlineColor'!~'^[0-9A-Fa-f]{6}$'))then raise exception 'Invalid underline color';end if;
  if run_value?'underlineThickness'and(run_value->'underlineThickness'<>'null'::jsonb and(jsonb_typeof(run_value->'underlineThickness')<>'number'or(run_value->>'underlineThickness')::numeric not between 1 and 5))then raise exception 'Invalid underline thickness';end if;
  if run_value?'underlineWordsOnly'and jsonb_typeof(run_value->'underlineWordsOnly')<>'boolean'then raise exception 'Invalid words-only underline setting';end if;
  if coalesce((run_value->>'underline')::boolean,false)=false and(
   coalesce(run_value->'underlineStyle','null'::jsonb)<>'null'::jsonb or
   coalesce(run_value->'underlineColor','null'::jsonb)<>'null'::jsonb or
   coalesce(run_value->'underlineThickness','null'::jsonb)<>'null'::jsonb or
   coalesce((run_value->>'underlineWordsOnly')::boolean,false)
  )then raise exception 'Underline metadata requires underline';end if;
 end loop;
end$$;

create or replace function public.word_efficiency_without_underline_metadata(document_snapshot jsonb)
returns jsonb language sql immutable set search_path=pg_catalog,public as $$
 select jsonb_set(document_snapshot,'{blocks}',coalesce((
  select jsonb_agg(jsonb_set(block_rows.block_value,'{runs}',coalesce((
   select jsonb_agg(run_rows.run_value-'underlineStyle'-'underlineColor'-'underlineThickness'-'underlineWordsOnly' order by run_rows.ordinality)
   from jsonb_array_elements(block_rows.block_value->'runs')with ordinality as run_rows(run_value,ordinality)
  ),'[]'::jsonb))order by block_rows.ordinality)
  from jsonb_array_elements(document_snapshot->'blocks')with ordinality as block_rows(block_value,ordinality)
 ),'[]'::jsonb))
$$;

create or replace function public.assert_word_efficiency_document_schema(document_snapshot jsonb,editor_capabilities jsonb)
returns void language plpgsql immutable set search_path=pg_catalog,public as $$
begin
 perform public.assert_word_efficiency_underline_styles(document_snapshot);
 perform public.assert_word_efficiency_document_schema_before_underline_styles(public.word_efficiency_without_underline_metadata(document_snapshot),editor_capabilities);
end$$;

create or replace function public.word_efficiency_underline_feature(document_snapshot jsonb)
returns jsonb language sql immutable set search_path=pg_catalog,public as $$
 select coalesce(jsonb_object_agg(block_rows.block_value->>'id',(
  select jsonb_agg(jsonb_build_object(
   'underline',coalesce(run_rows.run_value->'underline','false'::jsonb),
   'style',coalesce(run_rows.run_value->'underlineStyle','null'::jsonb),
   'color',coalesce(run_rows.run_value->'underlineColor','null'::jsonb),
   'thickness',coalesce(run_rows.run_value->'underlineThickness','null'::jsonb),
   'wordsOnly',coalesce(run_rows.run_value->'underlineWordsOnly','false'::jsonb)
  )order by run_rows.ordinality)from jsonb_array_elements(block_rows.block_value->'runs')with ordinality as run_rows(run_value,ordinality)
 )order by block_rows.block_value->>'id'),'{}'::jsonb)
 from jsonb_array_elements(document_snapshot->'blocks')as block_rows(block_value)
$$;

create or replace function public.validate_word_efficiency_underline_write()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare effective_capabilities jsonb;baseline_document jsonb;
begin
 select public.normalize_word_efficiency_editor_capabilities(version_rows.editor_capabilities)into effective_capabilities from public.word_efficiency_versions as version_rows where version_rows.id=new.version_id;
 baseline_document:=coalesce(new.snapshot->'initial_editor_document',public.word_efficiency_initial_editor_document(new.original_document_snapshot));
 if new.document_autosave is distinct from old.document_autosave and new.document_autosave is not null then
  perform public.assert_word_efficiency_underline_styles(new.document_autosave);
  if not public.word_efficiency_command_enabled(effective_capabilities,'underline')and public.word_efficiency_underline_feature(new.document_autosave)is distinct from public.word_efficiency_underline_feature(baseline_document)then raise exception 'Disabled underline capability changed document feature';end if;
 end if;
 if new.final_document_snapshot is distinct from old.final_document_snapshot and new.final_document_snapshot is not null then
  perform public.assert_word_efficiency_underline_styles(new.final_document_snapshot);
  if not public.word_efficiency_command_enabled(effective_capabilities,'underline')and public.word_efficiency_underline_feature(new.final_document_snapshot)is distinct from public.word_efficiency_underline_feature(baseline_document)then raise exception 'Disabled underline capability changed document feature';end if;
 end if;
 return new;
end$$;

drop trigger if exists validate_word_efficiency_underline_write on public.word_efficiency_attempts;
create trigger validate_word_efficiency_underline_write before update of document_autosave,final_document_snapshot on public.word_efficiency_attempts for each row execute function public.validate_word_efficiency_underline_write();
revoke all on function public.assert_word_efficiency_document_schema_before_underline_styles(jsonb,jsonb),public.assert_word_efficiency_underline_styles(jsonb),public.word_efficiency_without_underline_metadata(jsonb),public.assert_word_efficiency_document_schema(jsonb,jsonb),public.word_efficiency_underline_feature(jsonb),public.validate_word_efficiency_underline_write()from public,anon,authenticated;

commit;
