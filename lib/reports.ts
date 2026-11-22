import type { SupabaseClient } from "@supabase/supabase-js";
import { attendancePercentage, defaulterList, type StudentSummary } from "./attendance";

export interface ReportData {
  className: string;
  subjectName: string | null;
  sessionsHeld: number;
  summaries: StudentSummary[];
  defaulters: StudentSummary[];
}

/**
 * Shared report computation for the reports page and the CSV/PDF exports.
 * sessionsHeld counts sessions of the class (optionally one subject) that
 * have ended (closed, or past ends_at). A student with no held sessions
 * gets percentage null — never an invented number.
 */
export async function buildReport(
  sb: SupabaseClient,
  classId: string,
  subjectId: string | null,
): Promise<ReportData | null> {
  const { data: cls } = await sb.from("classes").select("id, name").eq("id", classId).single();
  if (!cls) return null;
  let subjectName: string | null = null;
  if (subjectId) {
    const { data: subj } = await sb.from("subjects").select("name").eq("id", subjectId).single();
    subjectName = (subj as { name: string } | null)?.name ?? null;
  }
  const { data: enrollments } = await sb
    .from("class_enrollments")
    .select("student_id")
    .eq("class_id", classId);
  const studentIds = ((enrollments ?? []) as { student_id: string }[]).map((e) => e.student_id);
  let sessionsQuery = sb.from("sessions").select("id, subject_id, status, ends_at").eq("class_id", classId);
  if (subjectId) sessionsQuery = sessionsQuery.eq("subject_id", subjectId);
  const { data: sessions } = await sessionsQuery;
  const now = new Date();
  const held = ((sessions ?? []) as { id: string; status: string; ends_at: string }[]).filter(
    (s) => s.status === "closed" || new Date(s.ends_at) <= now,
  );
  const heldIds = held.map((s) => s.id);
  const { data: profiles } = studentIds.length
    ? await sb.from("profiles").select("id, full_name, roll_no").in("id", studentIds)
    : { data: [] as { id: string; full_name: string; roll_no: string | null }[] };
  const profileById = new Map(
    ((profiles ?? []) as { id: string; full_name: string; roll_no: string | null }[]).map((p) => [p.id, p]),
  );
  const { data: records } = heldIds.length
    ? await sb.from("attendance_records").select("student_id, status").in("session_id", heldIds)
    : { data: [] as { student_id: string; status: string }[] };
  const byStudent = new Map<string, { student_id: string; status: "present" | "late" | "absent" }[]>();
  for (const r of (records ?? []) as { student_id: string; status: "present" | "late" | "absent" }[]) {
    const list = byStudent.get(r.student_id) ?? [];
    list.push(r);
    byStudent.set(r.student_id, list);
  }
  const summaries: StudentSummary[] = studentIds.map((id) => {
    const rows = byStudent.get(id) ?? [];
    const p = profileById.get(id);
    return {
      student_id: id,
      full_name: p?.full_name ?? "Unknown",
      roll_no: p?.roll_no ?? null,
      percentage: attendancePercentage(rows, held.length),
      attended: rows.filter((r) => r.status === "present" || r.status === "late").length,
      sessionsHeld: held.length,
    };
  });
  summaries.sort((a, b) => (a.percentage ?? 999) - (b.percentage ?? 999));
  return {
    className: (cls as { name: string }).name,
    subjectName,
    sessionsHeld: held.length,
    summaries,
    defaulters: defaulterList(summaries),
  };
}
