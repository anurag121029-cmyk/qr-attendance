# QR-Based Attendance System — Build Plan (draft, 2026-11-10)

User asked for ideas to make this college project worth doing (2026-11-10, side chat
"QR attendance system project ideas"). Assistant already gave the ideas; this plan turns
them into a concrete build the user can approve with one word. Nothing is built yet.

## The angle that earns marks: stop proxy attendance
A static QR can be screenshotted and shared. The project wins by making that fail:
- **Rotating QR** — new code every 15 seconds; a screenshot expires.
- **Location check** — scan only counts within ~100 m of the classroom.
- **One device, one scan** — one student ID once per session; one phone can't mark two students.
- **Time rules** — Present in first 10 min, Late after, Absent when the session closes.
  Teacher can correct manually.

## Phase 1 (build first) — working demo
- Roles: Admin, Teacher, Student (Supabase Auth).
- Teacher: create class/subject, open a session, rotating QR on screen, live list of
  who has marked, close session automatically at end time.
- Student (phone, PWA — no Play Store install): scan QR, attendance marked instantly,
  see own % and history.
- Defaulter list below 75%, export attendance as Excel/PDF.
- Tables: users, classes, subjects, sessions, attendance_records.

## Phase 2 — anti-proxy hardening
Rotating QR + location check + device binding + Present/Late/Absent logic + manual edit.

## Phase 3 — polish
Analytics dashboard (per student / subject / month, at-risk list), parent email for low
attendance, leave requests, offline scan with later sync, face check after scan (optional).

## Stack — same as EDITH, so nothing new to learn
Next.js 15 + TypeScript + Tailwind + Supabase + Vercel, as a PWA. Needs its OWN Supabase
project (do not reuse EDITH's edith-ai project/database).

## Viva / demo plan
- Live demo with 2 phones: teacher phone shows QR, student phone scans it.
- The memorable test: try proxy attendance (screenshot the QR, scan from outside the
  room / after expiry) and show it failing.
- Report: problem statement, why manual attendance wastes time, system diagram,
  database design, screenshots, failed-proxy test case.

## Decisions still needed from the user
1. Build Phase 1 now? (Say yes and building starts at ~/workspace/qr-attendance.)
2. College/class details for realistic demo data (department, subjects, class size)?
   Defaults can be used if they don't answer — not a blocker.
3. New Supabase project for this app (free tier, like EDITH) — needed before live deploy.
