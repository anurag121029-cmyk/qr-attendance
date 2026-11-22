import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { createServerSupabase } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { buildReport } from "@/lib/reports";
import { sanitizeForPdf, wrapText } from "@/lib/report";
import { DEFAULTER_THRESHOLD } from "@/lib/attendance";

/** GET /api/reports/pdf?classId=…&subjectId=… — teacher/admin PDF export. */
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

  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const margin = 50;
  const width = 595.28;
  const height = 841.89;
  let page = doc.addPage([width, height]);
  let y = height - margin;
  const maxWidth = width - margin * 2;
  const drawLine = (text: string, size: number, useBold = false, gap = 18) => {
    if (y < margin + gap) {
      page = doc.addPage([width, height]);
      y = height - margin;
    }
    page.drawText(sanitizeForPdf(text), { x: margin, y, size, font: useBold ? bold : font, color: rgb(0.09, 0.09, 0.16) });
    y -= gap;
  };
  drawLine("QR Attendance — Report", 18, true, 26);
  drawLine(`${report.className}${report.subjectName ? ` — ${report.subjectName}` : ""}`, 13, true, 22);
  drawLine(
    report.sessionsHeld === 0
      ? "No sessions held yet — no percentages to report."
      : `${report.sessionsHeld} session(s) held · ${report.defaulters.length} defaulter(s) below ${DEFAULTER_THRESHOLD}%`,
    11,
    false,
    24,
  );
  for (const s of report.summaries) {
    const line = `${s.full_name}${s.roll_no ? ` (${s.roll_no})` : ""} — ${s.attended}/${s.sessionsHeld} — ${
      s.percentage === null ? "no data" : `${s.percentage}%`
    }${s.percentage !== null && s.percentage < DEFAULTER_THRESHOLD ? " — DEFAULTER" : ""}`;
    for (const wrapped of wrapText(line, (t) => font.widthOfTextAtSize(t, 11), maxWidth)) {
      drawLine(wrapped || " ", 11, false, 15);
    }
  }
  const bytes = await doc.save();
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="attendance-${report.className.replace(/\s+/g, "-")}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
