/**
 * Attendance status + percentage rules. Pure functions, unit-tested.
 * Present = scanned within `lateAfterMinutes` of the session start;
 * Late = scanned after that but before the session ends; Absent = the
 * session closed with no record. Present and Late both count as attended.
 */
export type AttendanceStatus = "present" | "late" | "absent";

export function statusForScan(
  sessionStart: Date,
  scannedAt: Date,
  lateAfterMinutes = 10,
): AttendanceStatus {
  const minutes = (scannedAt.getTime() - sessionStart.getTime()) / 60000;
  return minutes <= lateAfterMinutes ? "present" : "late";
}

export function isSessionOpen(session: { status: string; starts_at: string; ends_at: string }, now = new Date()): boolean {
  if (session.status !== "open") return false;
  return now >= new Date(session.starts_at) && now <= new Date(session.ends_at);
}

export function isSessionEnded(session: { status: string; ends_at: string }, now = new Date()): boolean {
  return session.status === "closed" || now > new Date(session.ends_at);
}

export interface AttendanceRow {
  student_id?: string;
  status: AttendanceStatus;
}

export interface SessionCount {
  session_id: string;
}

/**
 * Attendance % for one student: attended (present + late) over the number
 * of sessions held. Returns null when no sessions were held — never invent
 * a percentage from no data.
 */
export function attendancePercentage(
  records: AttendanceRow[],
  sessionsHeld: number,
): number | null {
  if (sessionsHeld <= 0) return null;
  const attended = records.filter((r) => r.status === "present" || r.status === "late").length;
  return Math.round((attended / sessionsHeld) * 1000) / 10;
}

export interface StudentSummary {
  student_id: string;
  full_name: string;
  roll_no: string | null;
  percentage: number | null;
  attended: number;
  sessionsHeld: number;
}

/** Students below `threshold`% (default 75) with at least one session held. */
export function defaulterList(
  summaries: StudentSummary[],
  threshold = 75,
): StudentSummary[] {
  return summaries.filter(
    (s) => s.percentage !== null && s.percentage < threshold,
  );
}

export const DEFAULTER_THRESHOLD = 75;
