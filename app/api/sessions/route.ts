import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { createServerSupabase } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";

/**
 * POST /api/sessions — teacher/admin creates a session. The rotating-QR
 * secret is generated here, server-side, and stored in sessions.qr_secret.
 * It is never returned to any client.
 */
export async function POST(req: Request) {
  const sb = await createServerSupabase();
  if (!sb) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const profile = await getProfile(sb, auth.user.id);
  if (!profile || (profile.role !== "teacher" && profile.role !== "admin")) {
    return NextResponse.json({ error: "Only teachers and admins can open a session." }, { status: 403 });
  }
  const body = await req.json().catch(() => null) as {
    classId?: string; subjectId?: string | null; startsAt?: string;
    durationMinutes?: number; lateAfterMinutes?: number;
    latitude?: number | null; longitude?: number | null;
  } | null;
  if (!body?.classId || !body.startsAt || !body.durationMinutes) {
    return NextResponse.json({ error: "classId, startsAt and durationMinutes are required." }, { status: 400 });
  }
  // Teacher must own the class (admins may use any class).
  const { data: cls } = await sb.from("classes").select("id, teacher_id").eq("id", body.classId).single();
  if (!cls) return NextResponse.json({ error: "Class not found." }, { status: 404 });
  if (profile.role === "teacher" && (cls as { teacher_id: string }).teacher_id !== profile.id) {
    return NextResponse.json({ error: "You can only open sessions for your own classes." }, { status: 403 });
  }
  const startsAt = new Date(body.startsAt);
  if (Number.isNaN(startsAt.getTime())) return NextResponse.json({ error: "Invalid startsAt." }, { status: 400 });
  const duration = Math.max(5, Math.min(480, Math.floor(body.durationMinutes)));
  const lateAfter = Math.max(0, Math.min(120, Math.floor(body.lateAfterMinutes ?? 10)));
  const endsAt = new Date(startsAt.getTime() + duration * 60000);
  const { data, error } = await sb
    .from("sessions")
    .insert({
      class_id: body.classId,
      subject_id: body.subjectId ?? null,
      teacher_id: profile.id,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      late_after_minutes: lateAfter,
      latitude: body.latitude ?? null,
      longitude: body.longitude ?? null,
      qr_secret: randomBytes(32).toString("hex"),
      status: "open",
    })
    .select("id")
    .single();
  if (error || !data) return NextResponse.json({ error: error?.message ?? "Could not create session." }, { status: 500 });
  return NextResponse.json({ id: (data as { id: string }).id });
}
