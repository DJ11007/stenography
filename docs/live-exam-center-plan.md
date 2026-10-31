# Live Exam Center — plan (agreed 2026-10-31)

A live exam is a timed sequence of **sections** built from tests that already exist on the site (or are uploaded
from the builder), run on one fixed server clock for every student, with automatic gap timers between sections,
one attempt per student, and a downloadable results sheet.

## Section types
| Type | Uses | Settings |
|---|---|---|
| Typing — Hindi / English | an existing typing test | duration, marks method (e.g. RSMSSB correct words × marks, max 25) |
| Stenography — Hindi / English | an existing stenography task | dictation speed + dictation time, transcription time |
| Word Efficiency | an existing Word test | duration, max marks |
| Excel Efficiency | an existing Excel test | duration, max marks |

Every section has a **gap after it** (minutes:seconds countdown, waiting only; the next section starts by itself at
00:00). The admin can add, remove and reorder sections and change every duration and gap.

## Templates (starting points, all editable)
| Exam | Sections (from the site's own exam data where it exists) |
|---|---|
| RSMSSB LDC | Hindi typing 10 → gap 2 → English typing 10 → gap 5 → Word 10 → gap 2 → Excel 10 (user's pattern) |
| RHC LDC | English typing 10, Hindi typing 10 (+ efficiency papers as the admin sets) |
| Delhi Police HCM | typing (English or Hindi) 10 |
| RSMSSB Stenographer | stenography (Hindi/English) as in `lib/stenography-categories.ts` (rsmssb-steno) |
| RHC Stenographer | stenography as in rajasthan-hc-steno |
| SSC Stenographer | dictation 10 min @ 80 wpm, transcription 50 min (English) / 65 min (Hindi) |
| RVUNL LDC | not on the site yet — admin builds it |

## Pages
- **Admin → Live Exam Center** (`/admin/live-exams`): list, create from template or blank, pick a test per section
  (with "Upload new" links), schedule start time and result time, publish; results sheet download.
- **Student → Live Exam** (`/live-exam/[examId]`, separate from `/live-test`): waiting countdown → sections and gaps on
  the server clock → "Exam completed". Late joiners start at the running section; a reconnect resumes it.
- **Results sheet** (CSV, opens in Excel): `Name | <Section 1> (max) | <Section 2> (max) | … | Total (sum of max)`,
  e.g. `Name | Hindi Typing (25) | English Typing (25) | Word Efficiency (25) | Excel Efficiency (25) | Total (100)`.

## Build order
1. Database: `live_exams` (title, template, starts_at, results_at, status) and `live_exam_sections` (order, type, test
   reference, durations, gap, max marks), `live_exam_participants` (student, the attempt id of each section); RPCs that
   compute the current section from the server clock and refuse a second attempt.
2. Admin builder + templates.
3. Student exam page reusing the existing typing / stenography / Word / Excel workspaces in a "live exam" mode
   (fixed duration, auto-submit at the section's end, no settings).
4. Results sheet download and the combined result.
5. Full trial run with test accounts before a real exam.
