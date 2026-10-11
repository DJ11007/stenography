begin;

-- Real reported bug: get_word/excel_efficiency_attempt_result's
-- 'maximumMarks' field read the TEST's CURRENT maximum_marks
-- (version_record.maximum_marks) instead of what the attempt was actually
-- scored out of when the student took it. Editing a test's question bank
-- later (e.g. correcting a per-question mark value, or the "50 should be
-- 25" fix applied alongside this migration) would silently change an
-- already-graded student's "Maximum Marks" header while their per-question
-- rows (word/excel_efficiency_question_scores, frozen at attempt creation)
-- and the results table's own Grand Total kept summing to the OLD total --
-- header and table would disagree for every attempt taken under the old
-- marks scheme. attempt_record.snapshot->>'maximum_marks' is the actual
-- total frozen into the attempt when prepare_word/excel_efficiency_attempt
-- created it (see the 'maximum_marks',question_total snapshot field those
-- functions already write); that's what the header must match, not
-- whatever the test's template currently says. Falls back to the live
-- version value only for attempts old enough to predate that snapshot key.
create or replace function public.get_word_efficiency_attempt_result(p_attempt_id uuid)
returns jsonb language plpgsql security definer stable set search_path=pg_catalog,public as $$
declare attempt_record public.word_efficiency_attempts%rowtype;version_record public.word_efficiency_versions%rowtype;test_record public.word_efficiency_tests%rowtype;result_rows jsonb;is_published boolean;frozen_maximum_marks numeric;
begin
 if not public.is_active_word_efficiency_student()then raise exception'active student account required';end if;
 select attempt_rows.* into attempt_record from public.word_efficiency_attempts as attempt_rows where attempt_rows.id=p_attempt_id and attempt_rows.student_id=auth.uid();if not found or attempt_record.status not in('submitted','completed')then raise exception'attempt result unavailable';end if;
 select version_rows.* into version_record from public.word_efficiency_versions as version_rows where version_rows.id=attempt_record.version_id;if not found then raise exception'test version unavailable';end if;
 select test_rows.* into test_record from public.word_efficiency_tests as test_rows where test_rows.id=attempt_record.test_id;
 is_published:=attempt_record.result is not null and(attempt_record.evaluation_status='published'or attempt_record.status='completed')and(not attempt_record.is_live_attempt or test_record.results_publish_at is null or now()>=test_record.results_publish_at);
 frozen_maximum_marks:=coalesce((attempt_record.snapshot->>'maximum_marks')::numeric,version_record.maximum_marks);
 select coalesce(jsonb_agg(jsonb_build_object('number',score_rows.question_number,'instruction',question_rows.instruction,'section',question_rows.section,'maximumMarks',score_rows.maximum_marks,'awardedMarks',case when is_published then score_rows.awarded_marks else null end,'feedback',case when is_published then score_rows.teacher_comment else null end,'gradingStatus',case when not is_published or score_rows.awarded_marks is null then'not_graded'else'graded'end)order by question_rows.display_order),'[]'::jsonb)into result_rows from public.word_efficiency_question_scores as score_rows join public.word_efficiency_questions as question_rows on question_rows.id=score_rows.question_id where score_rows.attempt_id=p_attempt_id;
 return jsonb_build_object('title',attempt_record.snapshot->>'title','language',attempt_record.snapshot->>'language','status',case when is_published then'published'else'pending'end,'submittedAt',attempt_record.submitted_at,'evaluatedAt',case when is_published then attempt_record.result_published_at end,'maximumMarks',frozen_maximum_marks,'marksObtained',case when is_published then attempt_record.result->'marks'else null end,'percentage',case when is_published then attempt_record.result->'percentage'else null end,'passingMarks',case when is_published then to_jsonb(version_record.passing_marks)else null end,'passed',case when is_published then attempt_record.result->'passed'else null end,'overallFeedback',case when is_published then attempt_record.overall_teacher_feedback end,'questions',result_rows);
end $$;

create or replace function public.get_excel_efficiency_attempt_result(p_attempt_id uuid)
returns jsonb language plpgsql security definer stable set search_path=pg_catalog,public as $$
declare attempt_record public.excel_efficiency_attempts%rowtype;version_record public.excel_efficiency_versions%rowtype;test_record public.excel_efficiency_tests%rowtype;result_rows jsonb;is_published boolean;frozen_maximum_marks numeric;
begin
 if not public.is_active_word_efficiency_student() then raise exception 'active student account required'; end if;
 select attempt_rows.* into attempt_record from public.excel_efficiency_attempts as attempt_rows where attempt_rows.id=p_attempt_id and attempt_rows.student_id=auth.uid(); if not found or attempt_record.status not in('submitted','completed') then raise exception 'attempt result unavailable'; end if;
 select version_rows.* into version_record from public.excel_efficiency_versions as version_rows where version_rows.id=attempt_record.version_id; if not found then raise exception 'test version unavailable'; end if;
 select test_rows.* into test_record from public.excel_efficiency_tests as test_rows where test_rows.id=attempt_record.test_id;
 is_published:=attempt_record.result is not null and(attempt_record.evaluation_status='published' or attempt_record.status='completed')and(not attempt_record.is_live_attempt or test_record.results_publish_at is null or now()>=test_record.results_publish_at);
 frozen_maximum_marks:=coalesce((attempt_record.snapshot->>'maximum_marks')::numeric,version_record.maximum_marks);
 select coalesce(jsonb_agg(jsonb_build_object('number',score_rows.question_number,'instruction',question_rows.instruction,'section',question_rows.section,'maximumMarks',score_rows.maximum_marks,'awardedMarks',case when is_published then score_rows.awarded_marks else null end,'feedback',case when is_published then score_rows.teacher_comment else null end,'gradingStatus',case when not is_published or score_rows.awarded_marks is null then'not_graded' else'graded' end) order by question_rows.display_order),'[]'::jsonb) into result_rows from public.excel_efficiency_question_scores as score_rows join public.excel_efficiency_questions as question_rows on question_rows.id=score_rows.question_id where score_rows.attempt_id=p_attempt_id;
 return jsonb_build_object('title',attempt_record.snapshot->>'title','language',attempt_record.snapshot->>'language','status',case when is_published then'published' else'pending' end,'submittedAt',attempt_record.submitted_at,'evaluatedAt',case when is_published then attempt_record.result_published_at end,'maximumMarks',frozen_maximum_marks,'marksObtained',case when is_published then attempt_record.result->'marks' else null end,'percentage',case when is_published then attempt_record.result->'percentage' else null end,'passingMarks',case when is_published then to_jsonb(version_record.passing_marks) else null end,'passed',case when is_published then attempt_record.result->'passed' else null end,'overallFeedback',case when is_published then attempt_record.overall_teacher_feedback end,'questions',result_rows);
end $$;

commit;
