-- Switch every test (Word + Excel, existing and future) onto the one auto-generated, letterheaded question paper
-- (components/efficiency/question-paper-sheet.tsx) instead of an admin-uploaded PDF file:
-- 1) question_paper_ready defaults to true from now on, so a newly created test needs no manual toggle.
-- 2) Every existing test gets question_paper_ready = true right now.
-- 3) Every existing version with an old uploaded PDF (delivery_pdf = true) has that turned off, so its
--    "Private question paper PDF" / "Download Question Paper PDF" button (gated on delivery_pdf) stops
--    showing and only the new, branded paper remains. The uploaded files themselves are left in storage
--    untouched (delivery_pdf is just a display flag), in case anyone wants to look at them again.
-- Safe to run twice.
begin;

alter table public.excel_efficiency_tests alter column question_paper_ready set default true;
alter table public.word_efficiency_tests alter column question_paper_ready set default true;

update public.excel_efficiency_tests set question_paper_ready = true where question_paper_ready is distinct from true;
update public.word_efficiency_tests set question_paper_ready = true where question_paper_ready is distinct from true;

update public.excel_efficiency_versions set delivery_pdf = false where delivery_pdf = true;
update public.word_efficiency_versions set delivery_pdf = false where delivery_pdf = true;

commit;
