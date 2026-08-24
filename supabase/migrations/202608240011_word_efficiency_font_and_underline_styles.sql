begin;

-- Additive validation for structured underline metadata. Historical boolean-only
-- runs remain valid and no stored version or attempt is rewritten.
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
  if coalesce((run_value->>'underline')::boolean,false)=false and(coalesce(run_value->>'underlineStyle','')<>''or coalesce((run_value->>'underlineWordsOnly')::boolean,false))then raise exception 'Underline metadata requires underline';end if;
 end loop;
end$$;

create or replace function public.validate_word_efficiency_underline_write()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if new.document_autosave is distinct from old.document_autosave and new.document_autosave is not null then perform public.assert_word_efficiency_underline_styles(new.document_autosave);end if;
 if new.final_document_snapshot is distinct from old.final_document_snapshot and new.final_document_snapshot is not null then perform public.assert_word_efficiency_underline_styles(new.final_document_snapshot);end if;
 return new;
end$$;

drop trigger if exists validate_word_efficiency_underline_write on public.word_efficiency_attempts;
create trigger validate_word_efficiency_underline_write before update of document_autosave,final_document_snapshot on public.word_efficiency_attempts for each row execute function public.validate_word_efficiency_underline_write();
revoke all on function public.assert_word_efficiency_underline_styles(jsonb),public.validate_word_efficiency_underline_write()from public;

commit;
