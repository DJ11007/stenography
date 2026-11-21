-- 21 Nov 2026 (Live Exam 9(1)): a final sheet / document that reaches the server up to 90 seconds after the time is
-- up (slow internet, a retry) is now the one that is marked -- before, it was thrown away and an older autosave was
-- marked. The screen locks at time-up, so this adds no working time. And the marking of a big sheet (Excel Test 8:
-- 4-10 s) no longer hits the 8 s limit for signed-in requests (a submit failed with 500 at 10.3 s).
do $$
declare d text;
begin
  d := pg_get_functiondef('public.submit_excel_efficiency_document'::regproc);
  if position('now() <= attempt_record.started_at + make_interval(secs => attempt_record.selected_duration_seconds) then' in d) = 0 then raise exception 'excel submit: anchor not found'; end if;
  d := replace(d, 'now() <= attempt_record.started_at + make_interval(secs => attempt_record.selected_duration_seconds) then', 'now() <= attempt_record.started_at + make_interval(secs => attempt_record.selected_duration_seconds) + interval ''90 seconds'' then');
  execute d;
  d := pg_get_functiondef('public.submit_word_efficiency_document'::regproc);
  if position('if now()<=attempt_record.started_at+make_interval(secs=>attempt_record.selected_duration_seconds)then' in d) = 0 then raise exception 'word submit: anchor not found'; end if;
  d := replace(d, 'if now()<=attempt_record.started_at+make_interval(secs=>attempt_record.selected_duration_seconds)then', 'if now()<=attempt_record.started_at+make_interval(secs=>attempt_record.selected_duration_seconds)+interval ''90 seconds''then');
  execute d;
end $$;
alter role authenticated set statement_timeout = '30s';
notify pgrst, 'reload config';
