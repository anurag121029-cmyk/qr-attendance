"use client";
import { useEffect, useState } from "react";

interface Attendee { student_id: string; full_name: string; roll_no: string | null; status: string; marked_at: string; location_verified: boolean; }
interface QrState { status: string; svg: string; code: string; sessionId: string; secondsLeft: number; present: number; late: number; }

export default function SessionLive({ sessionId }: { sessionId: string }) {
  const [qr, setQr] = useState<QrState | null>(null);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [error, setError] = useState("");
  const [closed, setClosed] = useState(false);

  async function loadQr() {
    const res = await fetch(`/api/sessions/${sessionId}/qr`);
    if (!res.ok) { setError("Could not load the QR code. Are you the teacher of this session?"); return; }
    const body = await res.json();
    setQr(body);
    if (body.status === "closed") setClosed(true);
  }
  async function loadAttendees() {
    const res = await fetch(`/api/sessions/${sessionId}/attendees`);
    if (res.ok) setAttendees(await res.json());
  }
  useEffect(() => {
    loadQr();
    loadAttendees();
    const t = setInterval(() => { loadQr(); loadAttendees(); }, 5000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  async function closeSession() {
    const res = await fetch(`/api/sessions/${sessionId}/close`, { method: "POST" });
    if (res.ok) { setClosed(true); loadQr(); }
    else setError("Could not close the session.");
  }

  return (
    <div>
      {error && <p className="error">{error}</p>}
      <div className="card">
        <h2>Live QR code</h2>
        {closed ? (
          <p><span className="badge badge-absent">Session closed</span> — this QR no longer works.</p>
        ) : qr ? (
          <>
            <div className="qr-box">
              <div dangerouslySetInnerHTML={{ __html: qr.svg }} />
            </div>
            <p style={{ textAlign: "center" }}>
              Manual code: <code style={{ fontSize: "1.3rem", letterSpacing: "0.2em" }}>{qr.code}</code>
              <br />
              <span className="muted">New code in {qr.secondsLeft}s · Session: <code>{qr.sessionId.slice(0, 8)}</code>…</span>
            </p>
            <p className="muted" style={{ textAlign: "center" }}>
              Students scan with the Scan QR page, or type the session id + this code.
              A screenshot stops working after the code rotates.
            </p>
          </>
        ) : (
          <p>Loading QR code…</p>
        )}
        <p>
          <span className="badge">Present: {qr?.present ?? 0}</span>{" "}
          <span className="badge badge-late">Late: {qr?.late ?? 0}</span>{" "}
          <span className="badge badge-muted">Marked: {attendees.length}</span>
        </p>
        {!closed && (
          <button className="btn btn-danger" onClick={closeSession}>Close session</button>
        )}
      </div>
      <div className="card">
        <h2>Who has marked</h2>
        {attendees.length === 0 ? (
          <p className="muted">Nobody has marked yet. The list updates automatically.</p>
        ) : (
          <table className="data">
            <thead><tr><th>Name</th><th>Roll no.</th><th>Status</th><th>Marked at</th><th>Location</th></tr></thead>
            <tbody>
              {attendees.map((a) => (
                <tr key={a.student_id}>
                  <td>{a.full_name}</td>
                  <td>{a.roll_no ?? "—"}</td>
                  <td><span className={`badge ${a.status === "late" ? "badge-late" : ""}`}>{a.status}</span></td>
                  <td>{new Date(a.marked_at).toLocaleTimeString()}</td>
                  <td>{a.location_verified ? "verified" : "unverified"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
