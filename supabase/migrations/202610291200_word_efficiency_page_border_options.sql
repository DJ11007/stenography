-- Word Efficiency: the options of a page border (Borders and Shading > Page Border > Options) can be marked.
--
-- The editor now saves, after the line and before any " sides:...", the choices of Word's Options dialog in
-- pageLayout.border (lib/word-page-border.ts):
--   " measure:text"            measured from the text (absent = Edge of page, Word's default)
--   " gap:T,R,B,L"             whole points per side (absent = 24 from the edge, 4 from the text)
--   " nohdr" / " noftr"        header / footer not surrounded (text only)
-- The line (style, colour, width) is still not marked, so two derived targets give just these values, like
-- pageLayout.borderSides (migration 202610191300) gives the sides:
--   pageLayout.borderMeasure   "page" | "text"                    (null without a border)
--   pageLayout.borderDistance  "top,right,bottom,left" in points  (null without a border)
-- The Model Answer page asks for them only when they differ from Word's defaults.
begin;

create or replace function public.word_efficiency_page_border_option(p_border text, p_what text)
returns jsonb
language sql
immutable
set search_path to 'pg_catalog', 'public'
as $function$
  select case
    when p_border is null or btrim(p_border) = '' or p_border ~* '(^|\s)none(\s|$)' then null
    when p_what = 'measure' then to_jsonb(case when p_border ~ ' measure:text( |$)' then 'text' else 'page' end::text)
    when p_what = 'distance' then to_jsonb(coalesce(
      substring(p_border from ' gap:([0-9]+,[0-9]+,[0-9]+,[0-9]+)'),
      case when p_border ~ ' measure:text( |$)' then '4,4,4,4' else '24,24,24,24' end)::text)
    else null
  end
$function$;
revoke all on function public.word_efficiency_page_border_option(text, text) from public, anon, authenticated;

create or replace function public.word_efficiency_grading_target_value(document jsonb, target text)
returns jsonb
language plpgsql
immutable
set search_path to 'pg_catalog', 'public'
as $function$
declare parts text[];value jsonb;segment text;index_value integer;
begin
 if document is null or target is null or target=''then return null;end if;
 parts:=string_to_array(target,'.');
 if parts[1]='pageLayout'then
  if parts[2]='borderSides' and coalesce(array_length(parts,1),0)=2 then
   return public.word_efficiency_page_border_sides(document->'pageLayout'->>'border');
  end if;
  if parts[2]='borderMeasure' and coalesce(array_length(parts,1),0)=2 then
   return public.word_efficiency_page_border_option(document->'pageLayout'->>'border','measure');
  end if;
  if parts[2]='borderDistance' and coalesce(array_length(parts,1),0)=2 then
   return public.word_efficiency_page_border_option(document->'pageLayout'->>'border','distance');
  end if;
  value:=document->'pageLayout';
  for i in 2..coalesce(array_length(parts,1),1)loop if value is null then return null;end if;value:=value->parts[i];end loop;
  return value;
 end if;
 if parts[1]<>'blocks'or coalesce(array_length(parts,1),0)<3 then return null;end if;
 if parts[2] !~ '^[0-9]+$' then return null; end if;
 value:=(coalesce(document->'blocks','[]'::jsonb))->(parts[2]::integer);
 for i in 3..array_length(parts,1)loop
  if value is null then return null;end if;
  segment:=parts[i];
  if jsonb_typeof(value)='array'and segment~'^[0-9]+$'then index_value:=segment::integer;value:=value->index_value;
  elsif jsonb_typeof(value)='object'then value:=value->segment;
  else return null;end if;
 end loop;
 return value;
end $function$;

commit;
