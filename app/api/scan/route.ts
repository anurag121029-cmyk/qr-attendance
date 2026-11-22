import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { decodeQrPayload, qrCodeForWindow, qrWindowIndex, validateQrToken } from "@/lib/qr";
import { statusForScan } from "@/lib/attendance";
import { GEOFENCE_RADIUS_M, withinRadius } from "@/lib/geo";

/**
 * POST /api/scan — the ONLY place a scan is validated. All checks happen
 * here, server-side, never only in the browser:
 *  - signed-in student, enrolled in the session's class
 *  - session open and inside its start/end window
 *  - QR token matches the current or immediately previous 15s window
 *    (an expired screenshot fails)
 *  - one attendance per student per session (duplicate fails)
 *  - one device cannot mark two students in the same session
 *  - geofence: if the teacher set classroom coords, the scan must be
 *    within 100 m; if the phone gives no location, the record is still
 *    saved but flagged location_verified=false with the reason — never
 *    silently claimed as verified.
 */
export async function POST(req: Request) {
  const sb = await createServerSupabase();
  if (!sb) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const profile = await getProfile(sb, auth.user.id);
  if (!profile || profile.role !== "student") {
    return NextResponse.json({ error: "Only student accounts can mark attendance." }, { status: 403 });
  }
  const body = await req.json().catch(() => null) as {
    payload?: string; sessionId?: string; code?: string;
    deviceId?: string; latitude?: number | null; longitude?: number | null;
    locationReason?: string | null;
  } | null;
  if (!body) return NextResponse.json({ error: "Missing scan data." }, { status: 400 });
  const deviceId = typeof body.deviceId === "string" && body.deviceId.trim() ? body.deviceId.trim() : null;
  if (!deviceId) return NextResponse.json({ error: "Missing device id." }, { status: 400 });

  // Resolve session id + token check inputs from either a scanned QR
  // payload or the manual session-id + 6-letter code form.
  let sessionId: string | null = null;
  let tokenOk = false;
  let tokenReason: string | null = null;
  if (typeof body.payload === "string") {
    const payload = decodeQrPayload(body.payload);
    sessionId = payload?.s ?? null;
    // Token validation needs the session secret — fetched below; keep the
    // payload around for the check.
    (body as { _payload?: ReturnType<typeof decodeQrPayload> })._payload = payload;
  } else if (typeof body.sessionId === "string" && typeof body.code === "string") {
    sessionId = body.sessionId.trim();
  }
  if (!sessionId) return NextResponse.json({ error: "Could not read a session from this QR code. Try scanning again, or use the manual code." }, { status: 400 });

  const { data: session } = await sb
    .from("sessions")
    .select("id, class_id, teacher_id, starts_at, ends_at, late_after_minutes, latitude, longitude, qr_secret, status")
    .eq("id", sessionId)
    .single();
  if (!session) return NextResponse.json({ error: "Session not found." }, { status: 404 });
  const s = session as {
    id: string; class_id: string; starts_at: string; ends_at: string;
    late_after_minutes: number; latitude: number | null; longitude: number | null;
    qr_secret: string; status: string;
  };
  const now = new Date();
  if (s.status !== "open" || now < new Date(s.starts_at)) {
    return NextResponse.json({ error: "This session is not open yet." }, { status: 400 });
  }
  if (now > new Date(s.ends_at)) {
    return NextResponse.json({ error: "This session has ended — attendance is closed." }, { status: 400 });
  }

  // Token check (server-side, with the session secret from the DB).
  if (typeof body.payload === "string") {
    const payload = (body as { _payload?: ReturnType<typeof decodeQrPayload> })._payload ?? null;
    const check = validateQrToken(s.qr_secret, payload, s.id, now);
    tokenOk = check.ok;
    if (!check.ok) tokenReason = check.reason;
  } else if (typeof body.code === "string") {
    const submitted = body.code.trim().toUpperCase();
    const current = qrWindowIndex(now);
    tokenOk = [current, current - 1].some((w) => qrCodeForWindow(s.qr_secret, w) === submitted);
    if (!tokenOk) tokenReason = "expired";
  }
  if (!tokenOk) {
    return NextResponse.json(
      { error: "This QR code has expired. Ask the teacher to show the current code — a screenshot of an old code will not work." },
      { status: 400 },
    );
  }
  void tokenReason;

  // Enrolled in this class?
  const { data: enrollment } = await sb
    .from("class_enrollments")
    .select("id")
    .eq("class_id", s.class_id)
    .eq("student_id", profile.id)
    .single();
  if (!enrollment) {
    return NextResponse.json({ error: "You are not enrolled in this class. Join it with the class join code first." }, { status: 403 });
  }

  // One attendance per student per session.
  const { data: existing } = await sb
    .from("attendance_records")
    .select("id")
    .eq("session_id", s.id)
    .eq("student_id", profile.id)
    .single();
  if (existing) {
    return NextResponse.json({ error: "Attendance already marked for this session." }, { status: 409 });
  }
  // One device, one student per session.
  const { data: deviceUsed } = await sb
    .from("attendance_records")
    .select("id")
    .eq("session_id", s.id)
    .eq("device_id", deviceId)
    .neq("student_id", profile.id)
    .single();
  if (deviceUsed) {
    return NextResponse.json({ error: "This device already marked attendance for another student in this session." }, { status: 409 });
  }

  // Geofence.
  let locationVerified = false;
  let locationReason: string | null = typeof body.locationReason === "string" ? body.locationReason : null;
  let distanceMeters: number | null = null;
  const lat = typeof body.latitude === "number" ? body.latitude : null;
  const lng = typeof body.longitude === "number" ? body.longitude : null;
  if (s.latitude !== null && s.longitude !== null) {
    if (lat === null || lng === null) {
      locationVerified = false;
      locationReason = locationReason ?? "location unavailable";
    } else {
      const check = withinRadius(lat, lng, s.latitude, s.longitude, GEOFENCE_RADIUS_M);
      distanceMeters = Math.round(check.distanceMeters * 10) / 10;
      if (!check.within) {
        return NextResponse.json(
          { error: `You are ${Math.round(check.distanceMeters)} m from the classroom. Attendance only counts within ${GEOFENCE_RADIUS_M} m.` },
          { status: 403 },
        );
      }
      locationVerified = true;
    }
  } else if (lat !== null && lng !== null) {
    // No classroom location set: record the scan location, but do not
    // claim a geofence check passed.
    locationVerified = false;
    locationReason = "no classroom location set for this session";
  }

  const status = statusForScan(new Date(s.starts_at), now, s.late_after_minutes);
  const { error } = await sb.from("attendance_records").insert({
    session_id: s.id,
    student_id: profile.id,
    device_id: deviceId,
    status,
    marked_at: now.toISOString(),
    latitude: lat,
    longitude: lng,
    location_verified: locationVerified,
    location_unverified_reason: locationVerified ? null : locationReason,
  });
  if (error) {
    // A race between two scans hits the unique (session, student) key.
    if (error.code === "23505") {
      return NextResponse.json({ error: "Attendance already marked for this session." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({
    ok: true,
    status,
    message: status === "late" ? "Attendance marked — Late." : "Attendance marked — Present.",
    locationVerified,
    distanceMeters,
  });
}
