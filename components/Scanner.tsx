"use client";
import { useEffect, useRef, useState } from "react";
import { getOrCreateDeviceId } from "@/lib/device";

type ScanResult =
  | { ok: true; status: string; message: string; locationVerified: boolean; distanceMeters: number | null }
  | { ok: false; error: string };

export default function Scanner() {
  const [cameraOn, setCameraOn] = useState(false);
  const [sessionId, setSessionId] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState("");
  const scannerRef = useRef<{ stop: () => Promise<void> } | null>(null);
  const doneRef = useRef(false);

  useEffect(() => {
    return () => {
      scannerRef.current?.stop().catch(() => {});
    };
  }, []);

  async function getLocation(): Promise<{ latitude: number | null; longitude: number | null; reason: string | null }> {
    if (!("geolocation" in navigator)) return { latitude: null, longitude: null, reason: "geolocation not supported on this device" };
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000, enableHighAccuracy: true });
      });
      return { latitude: pos.coords.latitude, longitude: pos.coords.longitude, reason: null };
    } catch (e) {
      const err = e as GeolocationPositionError;
      return {
        latitude: null,
        longitude: null,
        reason: err.code === 1 ? "location permission denied" : "location unavailable",
      };
    }
  }

  async function submitScan(body: Record<string, unknown>) {
    if (doneRef.current || busy) return;
    setBusy(true);
    setError("");
    const loc = await getLocation();
    const res = await fetch("/api/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...body,
        deviceId: getOrCreateDeviceId(),
        latitude: loc.latitude,
        longitude: loc.longitude,
        locationReason: loc.reason,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setResult({ ok: false, error: data.error ?? "Scan failed." });
      doneRef.current = false; // allow retry after an error
      return;
    }
    doneRef.current = true;
    await scannerRef.current?.stop().catch(() => {});
    setCameraOn(false);
    setResult({
      ok: true,
      status: data.status,
      message: data.message ?? "Attendance marked.",
      locationVerified: data.locationVerified === true,
      distanceMeters: typeof data.distanceMeters === "number" ? data.distanceMeters : null,
    });
  }

  async function startCamera() {
    setError("");
    setResult(null);
    doneRef.current = false;
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode("qr-reader");
      scannerRef.current = scanner;
      setCameraOn(true);
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decoded) => { void submitScan({ payload: decoded }); },
        () => {},
      );
    } catch (e) {
      setCameraOn(false);
      setError(
        e instanceof Error
          ? `Camera could not start: ${e.message}. Use the manual code entry below instead.`
          : "Camera could not start. Use the manual code entry below instead.",
      );
    }
  }

  async function stopCamera() {
    await scannerRef.current?.stop().catch(() => {});
    setCameraOn(false);
  }

  async function submitManual(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);
    await submitScan({ sessionId: sessionId.trim(), code: code.trim().toUpperCase() });
  }

  return (
    <div>
      <div className="card">
        <h2>Scan with camera</h2>
        <p className="muted">Point your camera at the teacher&apos;s QR code. It changes every 15 seconds — an old screenshot will be rejected.</p>
        {!cameraOn ? (
          <button className="btn" onClick={startCamera} disabled={busy}>Start camera</button>
        ) : (
          <button className="btn btn-secondary" onClick={stopCamera}>Stop camera</button>
        )}
        <div id="qr-reader" style={{ marginTop: "1rem", maxWidth: 400 }} />
        {error && <p className="error">{error}</p>}
      </div>
      <div className="card">
        <h2>Or enter the code manually</h2>
        <p className="muted">The teacher&apos;s screen shows a 6-letter code under the QR. Ask for the session id if you don&apos;t have it — it is shown on the session page.</p>
        <form onSubmit={submitManual}>
          <label htmlFor="manual_session">Session id</label>
          <input id="manual_session" className="input" required value={sessionId} onChange={(e) => setSessionId(e.target.value)} placeholder="e.g. 3f2a… (full id from the teacher)" />
          <label htmlFor="manual_code">6-letter code on screen right now</label>
          <input id="manual_code" className="input" required maxLength={6} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="e.g. A1B2C3" />
          <div style={{ marginTop: "1rem" }}>
            <button className="btn" type="submit" disabled={busy}>{busy ? "Checking…" : "Mark attendance"}</button>
          </div>
        </form>
      </div>
      {busy && <p>Checking with the server…</p>}
      {result && result.ok && (
        <div className="card">
          <p className="success">✓ {result.message}</p>
          <p>Status: <span className={`badge ${result.status === "late" ? "badge-late" : ""}`}>{result.status}</span></p>
          <p className="muted">
            {result.locationVerified
              ? `Location verified${result.distanceMeters !== null ? ` — ${Math.round(result.distanceMeters)} m from the classroom` : ""}.`
              : "Location could not be verified (permission denied or unavailable) — your attendance is still recorded, but flagged as location-unverified for the teacher."}
          </p>
        </div>
      )}
      {result && !result.ok && (
        <div className="card"><p className="error">✗ {result.error}</p></div>
      )}
    </div>
  );
}
