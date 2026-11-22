"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface ClassRow { id: string; name: string; }
interface SubjectRow { id: string; class_id: string; name: string; }

export default function NewSessionPage() {
  const router = useRouter();
  const sb = createClient();
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [duration, setDuration] = useState(60);
  const [lateAfter, setLateAfter] = useState(10);
  const [useLocation, setUseLocation] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!sb) return;
    sb.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: cls } = await sb.from("classes").select("id, name").eq("teacher_id", data.user.id);
      setClasses((cls ?? []) as ClassRow[]);
      const { data: sub } = await sb.from("subjects").select("id, class_id, name");
      setSubjects((sub ?? []) as SubjectRow[]);
    });
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    let latitude: number | null = null;
    let longitude: number | null = null;
    if (useLocation) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 });
        });
        latitude = pos.coords.latitude;
        longitude = pos.coords.longitude;
      } catch {
        setError("Could not read your location. Untick the location option, or allow location access and try again.");
        return;
      }
    }
    setBusy(true);
    const res = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        classId, subjectId: subjectId || null, startsAt,
        durationMinutes: duration, lateAfterMinutes: lateAfter,
        latitude, longitude,
      }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) setError(body.error ?? "Could not create the session.");
    else router.push(`/sessions/${body.id}`);
  }

  if (!sb) return <div className="notice"><strong>Supabase is not configured.</strong> Add keys to .env.local (see README).</div>;

  return (
    <div className="card" style={{ maxWidth: 560 }}>
      <h1>Open a new session</h1>
      <p className="muted">The QR code appears on the session page and rotates every 15 seconds.</p>
      <form onSubmit={submit}>
        <label htmlFor="class">Class</label>
        <select id="class" className="input" required value={classId} onChange={(e) => { setClassId(e.target.value); setSubjectId(""); }}>
          <option value="">Select a class</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <label htmlFor="subject">Subject</label>
        <select id="subject" className="input" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
          <option value="">No subject (whole class)</option>
          {subjects.filter((s) => s.class_id === classId).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <label htmlFor="starts_at">Starts at</label>
        <input id="starts_at" className="input" type="datetime-local" required value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
        <label htmlFor="duration">Duration (minutes)</label>
        <input id="duration" className="input" type="number" min={5} max={480} value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
        <label htmlFor="late_after">Late after (minutes from start)</label>
        <input id="late_after" className="input" type="number" min={0} max={120} value={lateAfter} onChange={(e) => setLateAfter(Number(e.target.value))} />
        <label>
          <input type="checkbox" checked={useLocation} onChange={(e) => setUseLocation(e.target.checked)} />{" "}
          Use my current location as the classroom (students must be within 100 m)
        </label>
        {error && <p className="error">{error}</p>}
        <div style={{ marginTop: "1rem" }}>
          <button className="btn" type="submit" disabled={busy}>{busy ? "Creating…" : "Create session & show QR"}</button>
        </div>
      </form>
    </div>
  );
}
