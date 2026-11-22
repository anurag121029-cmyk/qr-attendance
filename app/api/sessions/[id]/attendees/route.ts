import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";

/** GET /api/sessions/[id]/attendees — live list for the teacher's session page. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const sb = await createServerSupabase();
  if (!sb) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const profile = await getProfile(sb, auth.user.id);
  if (!profile || (profile.role !== "teacher" && profile.role !== "admin")) {
    return NextResponse.json({ error: "Only the session teacher can view attendees." }, { status: 403 });
  }
  const { data: session } = await sb.from("sessions").select("teacher_id").eq("id", id).single();
  if (!session) return NextResponse.json({ error: "Session not found." }, { status: 404 });
  if (profile.role === "teacher" && (session as { teacher_id: string }).teacher_id !== profile.id) {
    return NextResponse.json({ error: "Only the session teacher can view attendees." }, { status: 403 });
  }
  const { data: records } = await sb
    .from("attendance_records")
    .select("student_id, status, marked_at, location_verified, profiles(full_name, roll_no)")
    .eq("session_id", id)
    .order("marked_at", { ascending: true });
  const rows = ((records ?? []) as unknown as {
    student_id: string; status: string; marked_at: string; location_verified: boolean;
    profiles: { full_name: string; roll_no: string | null } | null;
  }[]).map((r) => ({
    student_id: r.student_id,
    full_name: r.profiles?.full_name ?? "Unknown",
    roll_no: r.profiles?.roll_no ?? null,
    status: r.status,
    marked_at: r.marked_at,
    location_verified: r.location_verified,
  }));
  return NextResponse.json(rows);
}
