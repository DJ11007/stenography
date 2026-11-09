# Load test: 100+ students on Word / Excel efficiency tests (9 Nov 2026)

Method: no student passwords are used. The attempt hot paths were measured inside the live database in transactions that
are rolled back (nothing saved), plus 8 parallel database sessions. Autosave and submit already skip the extra
`auth.getUser()` round trips, so the cost is in the database functions.

Database: PostgreSQL 17, `max_connections` 60, `shared_buffers` 224 MB. Role limits: `authenticated` 8 s statement timeout.

## Per-student cost (idle database, one student)

| Test | Doc size (compressed) | Autosave validation | Marking pass (all questions) |
|---|---|---|---|
| Excel 2 | 104 KB | 20 ms | 44 ms |
| Excel 3 | 311 KB | 45 ms | 382 ms |
| **Excel 4 (200 students)** | 660 KB | **167 ms** | **1,697 ms** |
| **Excel 5 (200 employees)** | 556 KB | **134 ms** | **907 ms** |
| Excel 6 (30 items) | 5 KB | 13 ms | 47 ms |
| Word (all tests) | 3-79 KB | autosave every 20 s | 60-110 ms |

8 parallel autosave validations of Test 4 each still took 161-174 ms (no slowdown), but this does not prove the calls
fully overlapped; a real 100-session test needs 100 logged-in test students.

## Findings and fixes

1. **Submit marked every question 2-3 times.** `submit_excel_efficiency_document` called the marking function once for
   `awarded_marks` and again in each `WHEN` of the comment `CASE`. Test 4 submit = ~3.4 s; 100 students submitting at
   the timer end would queue and hit the 8 s timeout. Fixed in migration `202611091200_excel_submit_scores_each_question_once.sql`
   (marks and comments unchanged; paste it in the Supabase SQL Editor).
2. **Excel autosaved after every change (800 ms debounce) and sent the whole sheet.** On Tests 4/5 that is ~160 ms of
   database time per save; 100 students at ~0.3 saves/s = ~5 database-seconds per second. Sheets with more than 800
   cells now save at most every 8 s (small sheets such as Test 6 keep 800 ms). Submit still sends the final sheet.
3. Word is fine: 20 s autosave, ~100 ms marking.

## Still open

- A real end-to-end test with ~100 logged-in test students (needs test accounts; not done).
- Marking itself is slow on the 200-row papers (each cell is a separate criterion check); a rewrite of
  `excel_efficiency_criterion_matches` for column checks would help further.
- The database tier is small (60 connections). If many tests start at once, upgrade the compute size before a big live exam.
