begin;

create or replace function public.word_efficiency_canonical_measurement(measurement_value jsonb,measurement_kind text)
returns numeric language plpgsql immutable set search_path=pg_catalog,public as $$
declare measurement_text text;measurement_parts text[];measurement_number numeric;measurement_unit text;
begin
 if measurement_kind not in('length','lineHeight')then raise exception'Unknown measurement kind';end if;
 if measurement_value is null or measurement_value='null'::jsonb then return case when measurement_kind='lineHeight'then 1 else 0 end;end if;
 if jsonb_typeof(measurement_value)not in('string','number')then raise exception'Invalid editor measurement type';end if;
 measurement_text:=btrim(measurement_value#>>'{}');
 measurement_parts:=regexp_match(measurement_text,'^(-?(?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+))(px|pt|in|cm|mm)?$','i');
 if measurement_parts is null then raise exception'Invalid editor measurement %',measurement_text;end if;
 measurement_number:=measurement_parts[1]::numeric;measurement_unit:=lower(coalesce(measurement_parts[2],''));
 if measurement_kind='lineHeight'then if measurement_unit<>''then raise exception'Invalid line-height measurement %',measurement_text;end if;return round(measurement_number,6);end if;
 if measurement_unit=''and measurement_number<>0 then raise exception'Non-zero length requires a safe CSS unit';end if;
 return round(case measurement_unit when'px'then measurement_number*.75 when'in'then measurement_number*72 when'cm'then measurement_number*72/2.54 when'mm'then measurement_number*72/25.4 else measurement_number end,6);
end $$;

create or replace function public.word_efficiency_document_feature(d jsonb,f text)
returns jsonb language plpgsql immutable set search_path=pg_catalog,public as $$
declare feature_name alias for $2;feature_result jsonb;
begin
 if feature_name like'page:%'then return coalesce(d#>array['pageLayout',substr(feature_name,6)],'null'::jsonb);end if;
 if feature_name like'alignment:%'then select coalesce(jsonb_object_agg(block_entries.block_value->>'id',to_jsonb((block_entries.block_value->>'alignment')=substr(feature_name,11))order by block_entries.block_value->>'id'),'{}'::jsonb)into feature_result from jsonb_array_elements(d->'blocks')as block_entries(block_value);return feature_result;end if;
 if feature_name like'list:%'then select coalesce(jsonb_object_agg(block_entries.block_value->>'id',to_jsonb((block_entries.block_value#>>'{attrs,listStyle}')=substr(feature_name,6))order by block_entries.block_value->>'id')filter(where block_entries.block_value->>'type'='list-item'),'{}'::jsonb)into feature_result from jsonb_array_elements(d->'blocks')as block_entries(block_value);return feature_result;end if;
 if feature_name like'type:%'then select coalesce(jsonb_object_agg(block_entries.block_value->>'id',to_jsonb(block_entries.block_value->>'type')order by block_entries.block_value->>'id')filter(where block_entries.block_value->>'type'=substr(feature_name,6)),'{}'::jsonb)into feature_result from jsonb_array_elements(d->'blocks')as block_entries(block_value);return feature_result;end if;
 if feature_name in('marginLeft','marginRight','marginTop','marginBottom','lineHeight')then select coalesce(jsonb_object_agg(block_entries.block_value->>'id',to_jsonb(public.word_efficiency_canonical_measurement(block_entries.block_value#>array['attrs',feature_name],case when feature_name='lineHeight'then'lineHeight'else'length'end))order by block_entries.block_value->>'id'),'{}'::jsonb)into feature_result from jsonb_array_elements(d->'blocks')as block_entries(block_value);return feature_result;end if;
 if feature_name in('alignment','attrs','border','backgroundColor','hyphens','lineNumbers','dropCap','listStyle','rows','src','kind')then select coalesce(jsonb_object_agg(block_entries.block_value->>'id',case when feature_name='alignment'then block_entries.block_value->'alignment'when feature_name='attrs'then block_entries.block_value->'attrs'else coalesce(block_entries.block_value#>array['attrs',feature_name],'null'::jsonb)end order by block_entries.block_value->>'id'),'{}'::jsonb)into feature_result from jsonb_array_elements(d->'blocks')as block_entries(block_value);return feature_result;end if;
 select coalesce(jsonb_object_agg(block_entries.block_value->>'id',(select jsonb_agg(case feature_name when'bold'then coalesce(run_entries.run_value->'bold','false'::jsonb)when'italic'then coalesce(run_entries.run_value->'italic','false'::jsonb)when'underline'then coalesce(run_entries.run_value->'underline','false'::jsonb)when'strike'then coalesce(run_entries.run_value->'strike','false'::jsonb)when'doubleStrike'then coalesce(run_entries.run_value->'doubleStrike','false'::jsonb)when'superscript'then coalesce(run_entries.run_value->'superscript','false'::jsonb)when'subscript'then coalesce(run_entries.run_value->'subscript','false'::jsonb)when'href:external'then case when coalesce(run_entries.run_value->>'href','')~'^(https?://|mailto:)'then run_entries.run_value->'href'else'null'::jsonb end when'href:internal'then case when coalesce(run_entries.run_value->>'href','')~'^#bookmark-'then run_entries.run_value->'href'else'null'::jsonb end else coalesce(run_entries.run_value->feature_name,'null'::jsonb)end order by run_entries.ordinality)from jsonb_array_elements(block_entries.block_value->'runs')with ordinality as run_entries(run_value,ordinality))order by block_entries.block_value->>'id'),'{}'::jsonb)into feature_result from jsonb_array_elements(d->'blocks')as block_entries(block_value);return feature_result;
end $$;

revoke all on function public.word_efficiency_canonical_measurement(jsonb,text),public.word_efficiency_document_feature(jsonb,text)from public,anon,authenticated;

commit;
