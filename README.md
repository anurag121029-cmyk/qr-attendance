# QR Attendance — QR-Based Attendance System (Phase 1)

A college project: teachers open a class session and show a QR code; students
scan it from their phones and attendance is recorded. The point of the
project is **stopping proxy attendance**:

- **Rotating QR** — the code changes every 15 seconds. A screenshot shared
  with a friend expires before it can be scanned.
- **Geofence** — if the teacher sets a classroom location, scans only count
  within 100 m of it.
- **One device, one scan** — one student per session, and one phone cannot
  mark two students in the same session.
- **Time rules** — Present if scanned within the late-after window (default
  10 min), Late after that, Absent when the session closes.

This is a **completely separate project** from EDITH AI: its own repo, own
Supabase project, own Vercel project, own name/branding. It shares only the
generic stack pattern (Next.js + Supabase), and contains no EDITH features.

## Stack

Next.js 15 (App Router) + TypeScript + Tailwind v4 + Supabase
(`@supabase/ssr`) + `pdf-lib` for PDF export + `html5-qrcode` for phone
camera scanning. PWA: installable from the browser, no Play Store needed.
PWA icons are generated at install time from `public/icon.svg` — no binary
files are committed.

## Setup (local)

1. Create a **new** Supabase project at https://supabase.com (free tier).
   Do not reuse another project's database or keys.
2. In the Supabase SQL editor, run the whole file
   `supabase/apply-all.sql` once. It creates `profiles`, `classes`,
   `subjects`, `class_enrollments`, `sessions`, `attendance_records`, RLS
   policies and the profile-creation trigger.
3. Copy `.env.local.example` to `.env.local` and fill in your new project's
   URL and anon key:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_APP_URL` (e.g. `http://localhost:3000`)
4. In Supabase → Authentication → URL Configuration, add
   `http://localhost:3000/auth/callback` as a Redirect URL (and your live
   URL later).
5. Install and run:

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Demo flow

1. **Teacher** signs up (role Teacher), creates a class on the Classes page
   and adds a subject. The class gets a 6-letter join code.
2. **Students** sign up (role Student, with roll number) and join the class
   with that code.
3. **Teacher** opens a session (New Session): pick class/subject, start time,
   duration, late-after minutes. Optionally tick "use my current location"
   to set the classroom geofence.
4. The session page shows the rotating QR + the 6-letter code, and a live
   list of who has marked.
5. **Students** open Scan QR on their phones, allow the camera, and scan —
   or type the session id + the code shown on screen.
6. **Reports** page: per-class/per-subject %, defaulter list below 75%,
   CSV and PDF export.

### The viva demo: make proxy attendance fail

- Screenshot the QR, wait 20 seconds, scan the screenshot → rejected:
  "This QR code has expired."
- Scan from outside the classroom (when a location is set) → rejected with
  the distance in metres.
- Scan twice with the same account, or mark two students from one phone →
  rejected as a duplicate.

## Demo accounts / seed data

There is no seed script and no demo accounts with passwords — create real
accounts with Sign up (teacher + a few students), then follow the demo flow
above. Suggested demo data for the report: class "CSE 3rd Sem — Section A",
subjects "Data Structures (CS-301)" and "DBMS (CS-302)".

To make an account an admin (admins see all classes and reports), run in
the Supabase SQL editor:

```sql
update public.profiles set role = 'admin' where id = '<user uuid>';
```

## How the rotating QR works

Each session gets a random 32-byte secret, generated server-side when the
session is created (`sessions.qr_secret`, never sent to the browser). Time
is split into 15-second windows; the code for a window is the first 6
characters of `SHA-256(secret + ":" + window)`. The teacher's page polls
`GET /api/sessions/[id]/qr`, which renders the QR server-side. The scan is
validated only in `POST /api/scan` (server-side): it accepts the current
window or the immediately previous one, and rejects anything older.
See `lib/qr.ts` and `tests/qr.test.ts`.

## Honest limits

- Without Supabase keys, every page shows a "not configured" notice — the
  app never fakes a successful scan or attendance.
- If a student's phone gives no location (permission denied/unavailable),
  the scan is still recorded but flagged `location_verified = false` with
  the reason — it is never silently claimed as location-checked.
- Camera scanning needs HTTPS (or localhost) and camera permission; the
  manual code entry is the fallback.
- Attendance % is only calculated from sessions that have ended; with no
  held sessions the dashboard shows "no data", not 0%.
- This is Phase 1: no face check, no parent notifications, no offline
  scanning (see PLAN.md Phase 2/3).

## Commands

```bash
npm test        # vitest — pure logic in lib/ (QR tokens, attendance rules, geofence, CSV/PDF helpers)
npm run typecheck
npm run build
npm start
```
