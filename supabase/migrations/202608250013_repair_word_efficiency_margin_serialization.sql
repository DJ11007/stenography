begin;

-- Additive repair after applied migration 012. Browser formatting commands may
-- serialize an unchanged zero margin with an empty value or another CSS zero
-- unit. Normalize those representations without accepting non-zero values in
-- units outside the existing reviewed px/pt/in/cm/mm set.
create or replace function public.word_efficiency_canonical_measurement(measurement_value jsonb,measurement_kind text)
returns numeric language plpgsql immutable set search_path=pg_catalog,public as $$
declare measurement_text text;measurement_parts text[];measurement_number numeric;measurement_unit text;
begin
 if measurement_kind not in('length','lineHeight')then raise exception'Unknown measurement kind';end if;
 if measurement_value is null or measurement_value='null'::jsonb then return case when measurement_kind='lineHeight'then 1 else 0 end;end if;
 if jsonb_typeof(measurement_value)not in('string','number')then raise exception'Invalid editor measurement type';end if;
 measurement_text:=btrim(measurement_value#>>'{}');
 if measurement_text=''then return case when measurement_kind='lineHeight'then 1 else 0 end;end if;
 measurement_parts:=regexp_match(measurement_text,'^(-?(?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+))([a-z%]*)$','i');
 if measurement_parts is null then raise exception'Invalid editor measurement %',measurement_text;end if;
 measurement_number:=measurement_parts[1]::numeric;measurement_unit:=lower(coalesce(measurement_parts[2],''));
 if measurement_kind='lineHeight'then if measurement_unit<>''then raise exception'Invalid line-height measurement %',measurement_text;end if;return round(measurement_number,6);end if;
 if measurement_number=0 then return 0;end if;
 if measurement_unit not in('px','pt','in','cm','mm')then raise exception'Non-zero length requires a safe CSS unit';end if;
 return round(case measurement_unit when'px'then measurement_number*.75 when'in'then measurement_number*72 when'cm'then measurement_number*72/2.54 when'mm'then measurement_number*72/25.4 else measurement_number end,6);
end $$;

revoke all on function public.word_efficiency_canonical_measurement(jsonb,text)from public,anon,authenticated;

commit;
