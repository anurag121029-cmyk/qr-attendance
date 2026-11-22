import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { buildReport } from "@/lib/reports";
import { DEFAULTER_THRESHOLD } from "@/lib/attendance";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ classId?: string; subjectId?: string }>;
}) {
  const { classId, subjectId } = await searchParams;
  const sb = await createServerSupabase();
  if (!sb) return <div className="notice"><strong>Supabase is not configured.</strong> Add keys to .env.local (see README).</div>;
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect("/login");
  const profile = await getProfile(sb, auth.user.id);
  if (!profile || (profile.role !== "teacher" && profile.role !== "admin")) {
    return <div className="notice">Reports are for teachers and admins. Students see their own attendance on the dashboard.</div>;
  }
  const classQuery = profile.role === "admin"
    ? sb.from("classes").select("id, name").order("name")
    : sb.from("classes").select("id, name").eq("teacher_id", profile.id).order("name");
  const { data: classes } = await classQuery;
  const classList = (classes ?? []) as { id: string; name: string }[];
  const chosenClassId = classId ?? classList[0]?.id ?? null;
  const { data: subjects } = chosenClassId
    ? await sb.from("subjects").select("id, name").eq("class_id", chosenClassId).order("name")
    : { data: [] as { id: string; name: string }[] };
  const subjectList = (subjects ?? []) as { id: string; name: string }[];
  const report = chosenClassId ? await buildReport(sb, chosenClassId, subjectId ?? null) : null;

  return (
    <div>
      <h1>Reports</h1>
      {classList.length === 0 ? (
        <p className="muted">No classes yet. Create one from the Classes page.</p>
      ) : (
        <>
          <div className="card">
            <form method="get" style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "end" }}>
              <div>
                <label htmlFor="classId">Class</label>
                <select id="classId" name="classId" className="input" defaultValue={chosenClassId ?? ""}>
                  {classList.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="subjectId">Subject</label>
                <select id="subjectId" name="subjectId" className="input" defaultValue={subjectId ?? ""}>
                  <option value="">All subjects</option>
                  {subjectList.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <button className="btn" type="submit">Show report</button>
            </form>
          </div>
          {report && (
            <>
              <div className="card">
                <h2>
                  {report.className}
                  {report.subjectName ? ` — ${report.subjectName}` : ""}
                </h2>
                <p className="muted">
                  {report.sessionsHeld === 0
                    ? "No sessions held yet — percentages will appear once a session ends."
                    : `${report.sessionsHeld} session(s) held · ${report.defaulters.length} defaulter(s) below ${DEFAULTER_THRESHOLD}%`}
                </p>
                <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                  <Link className="btn btn-secondary" href={`/api/reports/csv?classId=${chosenClassId}${subjectId ? `&subjectId=${subjectId}` : ""}`}>Download CSV</Link>
                  <Link className="btn btn-secondary" href={`/api/reports/pdf?classId=${chosenClassId}${subjectId ? `&subjectId=${subjectId}` : ""}`}>Download PDF</Link>
                </div>
              </div>
              <div className="card">
                <h2>Attendance by student</h2>
                {report.summaries.length === 0 ? (
                  <p className="muted">No students enrolled in this class yet.</p>
                ) : (
                  <table className="data">
                    <thead><tr><th>Name</th><th>Roll no.</th><th>Attended</th><th>%</th><th>Status</th></tr></thead>
                    <tbody>
                      {report.summaries.map((s) => (
                        <tr key={s.student_id}>
                          <td>{s.full_name}</td>
                          <td>{s.roll_no ?? "—"}</td>
                          <td>{s.attended} / {s.sessionsHeld}</td>
                          <td>{s.percentage === null ? "—" : `${s.percentage}%`}</td>
                          <td>
                            {s.percentage === null ? <span className="badge badge-muted">no data</span>
                              : s.percentage < DEFAULTER_THRESHOLD ? <span className="badge badge-absent">defaulter</span>
                              : <span className="badge">ok</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
