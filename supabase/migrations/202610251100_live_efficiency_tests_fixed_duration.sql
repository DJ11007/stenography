-- A live (scheduled) Word or Excel Efficiency test runs for its set duration -- the first allowed
-- duration -- for every student. The duration choice (10/15/20/25/30 minutes) is for practice
-- tests only; a student could otherwise pick a longer time in a live exam (the page now offers no
-- choice for a live test, and this stops a hand-made request too). Only adds a check; running it
-- again changes nothing.
begin;

do $mig$
declare def text; old text; addition text;
begin
 def:=pg_get_functiondef('public.prepare_word_efficiency_attempt(uuid,integer,text)'::regprocedure);
 if position('a live test runs for its set duration' in def)=0 then
  old:='if not p_duration_seconds=any(version_record.duration_options)then raise exception ''duration unavailable'';end if;';
  addition:=' if test_record.is_live and p_duration_seconds<>version_record.duration_options[1] then raise exception ''a live test runs for its set duration'';end if;';
  if position(old in def)=0 then raise exception 'word: duration check not found'; end if;
  execute replace(def,old,old||addition);
 end if;
 def:=pg_get_functiondef('public.prepare_excel_efficiency_attempt(uuid,integer,boolean)'::regprocedure);
 if position('a live test runs for its set duration' in def)=0 then
  old:='if not p_duration_seconds=any(v.duration_options) then raise exception ''duration unavailable''; end if;';
  addition:=' if t.is_live and p_duration_seconds<>v.duration_options[1] then raise exception ''a live test runs for its set duration''; end if;';
  if position(old in def)=0 then raise exception 'excel: duration check not found'; end if;
  execute replace(def,old,old||addition);
 end if;
end $mig$;

commit;
