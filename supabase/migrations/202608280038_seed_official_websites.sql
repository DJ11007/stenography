begin;

-- Seeds the admin-managed Official Websites directory with the core exam
-- authorities students need for Rajasthan and All-India government exams:
-- SSO (the single sign-on used for most Rajasthan exam applications),
-- RSSB, RPSC, SSC, Indian Railways (RRB), and RVVUNL. URLs verified against
-- each board's current official domain. Idempotent: safe to re-run, and
-- does not touch rows an admin has already added or edited by hand.

insert into public.official_websites(name,url,description,is_published,display_order)
select v.name,v.url,v.description,true,v.display_order
from (values
  ('SSO Rajasthan','https://sso.rajasthan.gov.in','Single Sign-On for Rajasthan government services — use it to apply for most state exam recruitments and check application status.',1),
  ('RSSB','https://rssb.rajasthan.gov.in','Rajasthan Staff Selection Board — recruitment notifications, admit cards, and results for RSSB/RSMSSB exams (LDC, Patwari, and more).',2),
  ('RPSC','https://rpsc.rajasthan.gov.in','Rajasthan Public Service Commission — RAS and other Rajasthan state service exam notifications and results.',3),
  ('SSC','https://ssc.gov.in','Staff Selection Commission — CGL, CHSL, Stenographer Grade C/D, and other All-India government exams.',4),
  ('Indian Railways (RRB)','https://rrbapply.gov.in','Railway Recruitment Boards — apply online and check status for RRB NTPC, Group D, ALP, JE, and other railway exams.',5),
  ('RVVUNL','https://energy.rajasthan.gov.in/home','Rajasthan Rajya Vidyut Utpadan Nigam — power sector recruitment notifications (Junior Engineer, Junior Accountant, and more).',6)
) as v(name,url,description,display_order)
where not exists (select 1 from public.official_websites existing where existing.url = v.url);

commit;
