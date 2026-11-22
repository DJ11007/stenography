-- Word Efficiency: Borders and Shading > Page Border > "Apply to" can be marked (22 Nov 2026).
--
-- The editor now saves Word's Apply to choice in pageLayout.border (lib/word-page-border.ts), before any " sides:...":
--   (nothing)        Whole document (every border saved before)
--   " apply:s2"      This section (the section the cursor was in; 1 = before the first section break)
--   " apply:s1-first" / " apply:s1-rest"   This section - First page only / - All except first page
-- A derived target gives it, like pageLayout.borderSides / borderMeasure / borderDistance:
--   pageLayout.borderApply   "whole" | "s2" | "s1-first" | "s2-rest"   (null without a border)
-- " sides:..." stays last, so word_efficiency_page_border_sides and the existing regex rules read the same.
begin;

create or replace function public.word_efficiency_page_border_apply(p_border text)
returns jsonb
language sql
immutable
set search_path to 'pg_catalog', 'public'
as $function$
  select case
    when p_border is null or btrim(p_border) = '' or p_border ~* '(^|\s)none(\s|$)' then null
    else to_jsonb(coalesce(substring(p_border from ' apply:(s[0-9]+(-first|-rest)?)( |$)'), 'whole')::text)
  end
$function$;
revoke all on function public.word_efficiency_page_border_apply(text) from public, anon, authenticated;

do $$
declare d text;
 anchor text := 'if parts[2]=''borderMeasure'' and coalesce(array_length(parts,1),0)=2 then';
 added text := 'if parts[2]=''borderApply'' and coalesce(array_length(parts,1),0)=2 then' || chr(13) || chr(10)
   || '   return public.word_efficiency_page_border_apply(document->''pageLayout''->>''border'');' || chr(13) || chr(10)
   || '  end if;' || chr(13) || chr(10) || '  ';
begin
  d := pg_get_functiondef('public.word_efficiency_grading_target_value'::regproc);
  if position('borderApply' in d) > 0 then return; end if;
  if position(anchor in d) = 0 then raise exception 'borderMeasure anchor missing'; end if;
  execute replace(d, anchor, added || anchor);
end $$;

commit;
