import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { buildReport } from "@/lib/reports";
import { toCsv } from "@/lib/report";

/** GET /api/reports/csv?classId=…&subjectId=… — teacher/admin, Excel-compatible CSV. */
export async function GET(req: Request) {
  const sb = await createServerSupabase();
  if (!sb) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const profile = await getProfile(sb, auth.user.id);
  if (!profile || (profile.role !== "teacher" && profile.role !== "admin")) {
    return NextResponse.json({ error: "Only teachers and admins can export reports." }, { status: 403 });
  }
  const params = new URL(req.url).searchParams;
  const classId = params.get("classId");
  if (!classId) return NextResponse.json({ error: "classId is required." }, { status: 400 });
  const subjectId = params.get("subjectId");
  if (profile.role === "teacher") {
    const { data: cls } = await sb.from("classes").select("teacher_id").eq("id", classId).single();
    if (!cls || (cls as { teacher_id: string }).teacher_id !== profile.id) {
      return NextResponse.json({ error: "You can only export your own classes." }, { status: 403 });
    }
  }
  const report = await buildReport(sb, classId, subjectId);
  if (!report) return NextResponse.json({ error: "Class not found." }, { status: 404 });
  const csv = toCsv(
    ["Name", "Roll no.", "Sessions attended", "Sessions held", "Attendance %", "Defaulter (<75%)"],
    report.summaries.map((s) => [
      s.full_name,
      s.roll_no,
      s.attended,
      s.sessionsHeld,
      s.percentage === null ? "" : s.percentage,
      s.percentage !== null && s.percentage < 75 ? "yes" : "no",
    ]),
  );
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="attendance-${report.className.replace(/\s+/g, "-")}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
