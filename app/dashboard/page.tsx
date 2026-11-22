import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { attendancePercentage } from "@/lib/attendance";

export default async function DashboardPage() {
  const sb = await createServerSupabase();
  if (!sb) {
    return (
      <div className="notice">
        <strong>Supabase is not configured.</strong> Add{" "}
        <code>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
        <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to <code>.env.local</code>{" "}
        (copy from <code>.env.local.example</code>), run{" "}
        <code>supabase/apply-all.sql</code> in your new Supabase project, then
        restart the dev server.
      </div>
    );
  }
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect("/login");
  const profile = await getProfile(sb, auth.user.id);
  if (!profile) {
    return (
      <div className="notice">
        No profile found for this account. Sign up again, or ask an admin to
        create a profile row for this user id.
      </div>
    );
  }

  if (profile.role === "student") {
    const { data: enrollments } = await sb
      .from("class_enrollments")
      .select("class_id")
      .eq("student_id", profile.id);
    const classIds = ((enrollments ?? []) as { class_id: string }[]).map((e) => e.class_id);
    const nowIso = new Date().toISOString();
    const { data: sessions } = classIds.length
      ? await sb
          .from("sessions")
          .select("id, class_id, subject_id, starts_at, ends_at, status, classes(name), subjects(name)")
          .in("class_id", classIds)
          .order("starts_at", { ascending: true })
      : { data: [] as unknown[] };
    const allSessions = (sessions ?? []) as {
      id: string; class_id: string; subject_id: string | null; starts_at: string; ends_at: string; status: string;
      classes: { name: string } | null; subjects: { name: string } | null;
    }[];
    const upcoming = allSessions.filter((s) => s.status === "open" && s.ends_at > nowIso);
    const held = allSessions.filter((s) => s.status === "closed" || s.ends_at <= nowIso);
    const { data: records } = await sb
      .from("attendance_records")
      .select("session_id, status")
      .eq("student_id", profile.id);
    const myRecords = (records ?? []) as { session_id: string; status: "present" | "late" | "absent" }[];
    const heldIds = new Set(held.map((s) => s.id));
    const heldRecords = myRecords.filter((r) => heldIds.has(r.session_id));
    const pct = attendancePercentage(heldRecords, held.length);
    const recordBySession = new Map(myRecords.map((r) => [r.session_id, r.status]));
    return (
      <div>
        <h1>Hi, {profile.full_name || "Student"}</h1>
        <p className="muted">
          {profile.roll_no ? `Roll no. ${profile.roll_no} · ` : ""}
          {profile.department ?? ""} · Student
        </p>
        <div className="card">
          <h2>Your attendance</h2>
          {pct === null ? (
            <p>No sessions held yet in your classes — nothing to calculate from.</p>
          ) : (
            <p>
              <strong style={{ fontSize: "1.6rem" }}>{pct}%</strong>{" "}
              <span className="muted">
                ({heldRecords.filter((r) => r.status !== "absent").length} of {held.length} sessions attended)
              </span>
            </p>
          )}
          {pct !== null && pct < 75 && (
            <p className="error">Below 75% — you are on the defaulter list. Attend upcoming classes to recover.</p>
          )}
        </div>
        <div className="card">
          <h2>Upcoming sessions</h2>
          {upcoming.length === 0 ? (
            <p className="muted">No open sessions right now. Join a class first from the Classes page.</p>
          ) : (
            <ul>
              {upcoming.map((s) => (
                <li key={s.id}>
                  <strong>{s.subjects?.name ?? "Session"}</strong> — {s.classes?.name ?? ""} ·{" "}
                  {new Date(s.starts_at).toLocaleString()} ·{" "}
                  <Link href="/scan">Scan QR</Link>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="card">
          <h2>History</h2>
          {allSessions.length === 0 ? (
            <p className="muted">No sessions in your classes yet.</p>
          ) : (
            <table className="data">
              <thead><tr><th>Subject</th><th>Class</th><th>When</th><th>Status</th></tr></thead>
              <tbody>
                {allSessions.map((s) => {
                  const mine = recordBySession.get(s.id);
                  const ended = s.status === "closed" || s.ends_at <= nowIso;
                  return (
                    <tr key={s.id}>
                      <td>{s.subjects?.name ?? "—"}</td>
                      <td>{s.classes?.name ?? "—"}</td>
                      <td>{new Date(s.starts_at).toLocaleString()}</td>
                      <td>
                        {mine ? (
                          <span className={`badge ${mine === "late" ? "badge-late" : ""}`}>{mine}</span>
                        ) : ended ? (
                          <span className="badge badge-absent">absent</span>
                        ) : (
                          <span className="badge badge-muted">open</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    );
  }

  // Teacher / admin dashboard
  const { data: myClasses } = profile.role === "admin"
    ? await sb.from("classes").select("id, name, department, join_code").order("created_at", { ascending: false })
    : await sb.from("classes").select("id, name, department, join_code").eq("teacher_id", profile.id).order("created_at", { ascending: false });
  const classIds = ((myClasses ?? []) as { id: string }[]).map((c) => c.id);
  const { data: sessions } = classIds.length
    ? await sb.from("sessions").select("id, class_id, starts_at, ends_at, status, classes(name), subjects(name)").in("class_id", classIds).order("starts_at", { ascending: false }).limit(10)
    : { data: [] as unknown[] };
  const recent = (sessions ?? []) as {
    id: string; starts_at: string; ends_at: string; status: string;
    classes: { name: string } | null; subjects: { name: string } | null;
  }[];
  let counts: { students: number; teachers: number } | null = null;
  if (profile.role === "admin") {
    const { count: sCount } = await sb.from("profiles").select("id", { count: "exact", head: true }).eq("role", "student");
    const { count: tCount } = await sb.from("profiles").select("id", { count: "exact", head: true }).eq("role", "teacher");
    counts = { students: sCount ?? 0, teachers: tCount ?? 0 };
  }
  return (
    <div>
      <h1>Hi, {profile.full_name || profile.role}</h1>
      <p className="muted">{profile.role === "admin" ? "Admin" : "Teacher"} · {profile.department ?? ""}</p>
      {counts && (
        <div className="card">
          <h2>Overview</h2>
          <p>{counts.students} students · {counts.teachers} teachers · {classIds.length} classes</p>
        </div>
      )}
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "1rem" }}>
        <Link className="btn" href="/sessions/new">Open a new session</Link>
        <Link className="btn btn-secondary" href="/classes">Manage classes</Link>
        <Link className="btn btn-secondary" href="/reports">Reports</Link>
      </div>
      <div className="card">
        <h2>Your classes</h2>
        {((myClasses ?? []) as { id: string; name: string; department: string; join_code: string }[]).length === 0 ? (
          <p className="muted">No classes yet. Create one from the Classes page — students join with its 6-letter code.</p>
        ) : (
          <ul>
            {((myClasses ?? []) as { id: string; name: string; department: string; join_code: string }[]).map((c) => (
              <li key={c.id}>
                <strong>{c.name}</strong> ({c.department}) — join code: <code>{c.join_code}</code>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="card">
        <h2>Recent sessions</h2>
        {recent.length === 0 ? (
          <p className="muted">No sessions yet.</p>
        ) : (
          <ul>
            {recent.map((s) => (
              <li key={s.id}>
                <Link href={`/sessions/${s.id}`}>{s.subjects?.name ?? "Session"}</Link> — {s.classes?.name ?? ""} ·{" "}
                {new Date(s.starts_at).toLocaleString()} · <span className="badge">{s.status}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
