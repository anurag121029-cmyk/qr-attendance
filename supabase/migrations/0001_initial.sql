-- QR Attendance System — migration 0001
-- Tables: profiles, classes, subjects, class_enrollments, sessions,
-- attendance_records. Run via supabase/apply-all.sql in the SQL editor.

-- ---------- profiles (one row per auth user) ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'student' check (role in ('admin', 'teacher', 'student')),
  full_name text not null default '',
  roll_no text,
  department text,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- A user can read their own profile; admins can read all.
create policy "profiles: own read" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles: admin read all" on public.profiles
  for select using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
create policy "profiles: own update" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- New sign-ups get a profile. Role comes from the signup form metadata
-- (student/teacher); an admin promotes accounts to admin with SQL.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, role, full_name, roll_no, department)
  values (
    new.id,
    coalesce((new.raw_user_meta_data ->> 'role'), 'student'),
    coalesce((new.raw_user_meta_data ->> 'full_name'), ''),
    nullif((new.raw_user_meta_data ->> 'roll_no'), ''),
    nullif((new.raw_user_meta_data ->> 'department'), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- classes ----------
create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  department text not null default '',
  teacher_id uuid not null references public.profiles (id) on delete cascade,
  join_code text not null default substr(md5(random()::text), 1, 6),
  created_at timestamptz not null default now()
);
alter table public.classes enable row level security;

create policy "classes: teacher own" on public.classes
  for all using (teacher_id = auth.uid())
  with check (teacher_id = auth.uid());
create policy "classes: admin all" on public.classes
  for all using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
create policy "classes: enrolled student read" on public.classes
  for select using (exists (
    select 1 from public.class_enrollments e
    where e.class_id = classes.id and e.student_id = auth.uid()
  ));

-- ---------- subjects ----------
create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  name text not null,
  code text not null default '',
  created_at timestamptz not null default now()
);
alter table public.subjects enable row level security;

create policy "subjects: class teacher" on public.subjects
  for all using (exists (
    select 1 from public.classes c where c.id = subjects.class_id and c.teacher_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.classes c where c.id = subjects.class_id and c.teacher_id = auth.uid()
  ));
create policy "subjects: admin all" on public.subjects
  for all using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
create policy "subjects: enrolled student read" on public.subjects
  for select using (exists (
    select 1 from public.class_enrollments e
    where e.class_id = subjects.class_id and e.student_id = auth.uid()
  ));

-- ---------- class enrollments ----------
create table if not exists public.class_enrollments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (class_id, student_id)
);
alter table public.class_enrollments enable row level security;

create policy "enrollments: student own" on public.class_enrollments
  for select using (student_id = auth.uid());
create policy "enrollments: student join" on public.class_enrollments
  for insert with check (student_id = auth.uid());
create policy "enrollments: teacher read own classes" on public.class_enrollments
  for select using (exists (
    select 1 from public.classes c where c.id = class_enrollments.class_id and c.teacher_id = auth.uid()
  ));
create policy "enrollments: admin all" on public.class_enrollments
  for all using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- ---------- sessions ----------
-- qr_secret is the per-session secret behind the rotating QR code. It is
-- generated server-side at creation and is never returned to the browser;
-- only the 6-character code for the current 15-second window is shown.
create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  subject_id uuid references public.subjects (id) on delete set null,
  teacher_id uuid not null references public.profiles (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  late_after_minutes int not null default 10,
  latitude double precision,
  longitude double precision,
  qr_secret text not null,
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now()
);
alter table public.sessions enable row level security;

create policy "sessions: teacher own" on public.sessions
  for all using (teacher_id = auth.uid())
  with check (teacher_id = auth.uid());
create policy "sessions: admin all" on public.sessions
  for all using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
-- Students see sessions of classes they are enrolled in, but NOT qr_secret.
create policy "sessions: enrolled student read" on public.sessions
  for select using (exists (
    select 1 from public.class_enrollments e
    where e.class_id = sessions.class_id and e.student_id = auth.uid()
  ));

-- ---------- attendance records ----------
create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  device_id text not null default '',
  status text not null check (status in ('present', 'late', 'absent')),
  marked_at timestamptz not null default now(),
  latitude double precision,
  longitude double precision,
  location_verified boolean not null default false,
  location_unverified_reason text,
  created_at timestamptz not null default now(),
  unique (session_id, student_id)
);
alter table public.attendance_records enable row level security;

create policy "attendance: student own read" on public.attendance_records
  for select using (student_id = auth.uid());
create policy "attendance: teacher read own sessions" on public.attendance_records
  for select using (exists (
    select 1 from public.sessions s where s.id = attendance_records.session_id and s.teacher_id = auth.uid()
  ));
create policy "attendance: admin all" on public.attendance_records
  for all using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
-- Inserts go through the server /api/scan route, which runs with the
-- signed-in student's own client, so students may insert only their own row.
create policy "attendance: student insert own" on public.attendance_records
  for insert with check (student_id = auth.uid());
