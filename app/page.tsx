import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/config";

export default function Home() {
  return (
    <div>
      <h1>QR Attendance</h1>
      <p>
        College attendance that stops proxy attendance. The teacher shows a QR
        code that changes every 15 seconds — a screenshot shared with a friend
        expires before it can be scanned.
      </p>
      {!isSupabaseConfigured && (
        <div className="notice">
          <strong>Supabase is not configured yet.</strong> This app needs its
          own Supabase project (see README). Until keys are added to{" "}
          <code>.env.local</code>, sign-in, classes and scanning are
          unavailable — nothing here is faked.
        </div>
      )}
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "1rem" }}>
        <Link className="btn" href="/scan">Scan QR — student</Link>
        <Link className="btn btn-secondary" href="/sessions/new">Open a session — teacher</Link>
        <Link className="btn btn-secondary" href="/dashboard">Dashboard</Link>
      </div>
      <h2>How it works</h2>
      <ol>
        <li>Teacher creates a class and subject, then opens a session.</li>
        <li>The session page shows a QR code that rotates every 15 seconds.</li>
        <li>Students scan it from their phones. Present if scanned within the first 10 minutes, Late after that.</li>
        <li>One student, one scan per session. One phone cannot mark two students.</li>
        <li>If the teacher set a classroom location, scans only count within 100 m of it.</li>
      </ol>
      <h2>For teachers</h2>
      <p>
        Live list of who has marked, present/late counts, a below-75%
        defaulter list, and CSV / PDF exports per class and subject.
      </p>
    </div>
  );
}
