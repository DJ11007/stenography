-- Word / Excel Efficiency: the printable question paper (8 Nov 2026). When the admin turns "Question paper" on for a
-- test (after checking that it works), students get a "Download question paper" button on its Instructions page. The
-- paper is made from the test's current questions, so it always matches the test; no PDF has to be uploaded.
-- Off for every test to start with. Safe to run twice.
begin;

alter table public.word_efficiency_tests add column if not exists question_paper_ready boolean not null default false;
alter table public.excel_efficiency_tests add column if not exists question_paper_ready boolean not null default false;

commit;
