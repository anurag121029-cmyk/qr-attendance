import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";

/** POST /api/sessions/[id]/close — teacher/admin closes a session early. */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const sb = await createServerSupabase();
  if (!sb) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const profile = await getProfile(sb, auth.user.id);
  if (!profile || (profile.role !== "teacher" && profile.role !== "admin")) {
    return NextResponse.json({ error: "Only the session teacher can close it." }, { status: 403 });
  }
  const { data: session } = await sb.from("sessions").select("teacher_id").eq("id", id).single();
  if (!session) return NextResponse.json({ error: "Session not found." }, { status: 404 });
  if (profile.role === "teacher" && (session as { teacher_id: string }).teacher_id !== profile.id) {
    return NextResponse.json({ error: "Only the session teacher can close it." }, { status: 403 });
  }
  const { error } = await sb.from("sessions").update({ status: "closed" }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
