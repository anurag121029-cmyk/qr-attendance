import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { createServerSupabase } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { currentQrPayload, encodeQrPayload, secondsToNextWindow } from "@/lib/qr";
import { isSessionEnded } from "@/lib/attendance";

/**
 * GET /api/sessions/[id]/qr — teacher-only. Returns the current rotating
 * QR (SVG + payload + 6-letter code + seconds until it flips) and live
 * present/late counts. If the session has passed its end time it is
 * auto-closed here so the QR stops working.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const sb = await createServerSupabase();
  if (!sb) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const profile = await getProfile(sb, auth.user.id);
  if (!profile || (profile.role !== "teacher" && profile.role !== "admin")) {
    return NextResponse.json({ error: "Only the session teacher can view the QR." }, { status: 403 });
  }
  const { data: session } = await sb
    .from("sessions")
    .select("id, teacher_id, status, ends_at, qr_secret")
    .eq("id", id)
    .single();
  if (!session) return NextResponse.json({ error: "Session not found." }, { status: 404 });
  const s = session as { teacher_id: string; status: string; ends_at: string; qr_secret: string };
  if (profile.role === "teacher" && s.teacher_id !== profile.id) {
    return NextResponse.json({ error: "Only the session teacher can view the QR." }, { status: 403 });
  }
  let status = s.status;
  if (status === "open" && isSessionEnded({ status: s.status, ends_at: s.ends_at })) {
    await sb.from("sessions").update({ status: "closed" }).eq("id", id);
    status = "closed";
  }
  const { data: records } = await sb.from("attendance_records").select("status").eq("session_id", id);
  const rows = (records ?? []) as { status: string }[];
  const present = rows.filter((r) => r.status === "present").length;
  const late = rows.filter((r) => r.status === "late").length;
  if (status !== "open") {
    return NextResponse.json({ status, svg: "", code: "", sessionId: id, secondsLeft: 0, present, late });
  }
  const payload = currentQrPayload(id, s.qr_secret);
  const svg = await QRCode.toString(encodeQrPayload(payload), { type: "svg", margin: 1, width: 320 });
  return NextResponse.json({
    status,
    svg,
    code: payload.c,
    sessionId: id,
    secondsLeft: secondsToNextWindow(),
    present,
    late,
  });
}
