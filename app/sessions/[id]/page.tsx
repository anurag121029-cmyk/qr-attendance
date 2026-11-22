import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import SessionLive from "@/components/SessionLive";

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await createServerSupabase();
  if (!sb) return <div className="notice"><strong>Supabase is not configured.</strong> Add keys to .env.local (see README).</div>;
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect("/login");
  const { data: session } = await sb
    .from("sessions")
    .select("id, starts_at, ends_at, status, late_after_minutes, classes(name), subjects(name)")
    .eq("id", id)
    .single();
  if (!session) return <div className="notice">Session not found.</div>;
  const s = session as unknown as {
    starts_at: string; ends_at: string; status: string; late_after_minutes: number;
    classes: { name: string } | null; subjects: { name: string } | null;
  };
  return (
    <div>
      <h1>{s.subjects?.name ?? "Session"} — {s.classes?.name ?? ""}</h1>
      <p className="muted">
        {new Date(s.starts_at).toLocaleString()} to {new Date(s.ends_at).toLocaleTimeString()} ·{" "}
        Late after {s.late_after_minutes} min · Status: {s.status}
      </p>
      <SessionLive sessionId={id} />
    </div>
  );
}
