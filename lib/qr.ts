import { createHash } from "node:crypto";

/**
 * Rotating QR tokens — the anti-proxy core.
 *
 * A session has a random secret (generated server-side at creation, stored
 * in sessions.qr_secret, never sent to the browser except inside the token
 * code itself). Time is split into 15-second windows; the code for a window
 * is the first 6 characters of SHA-256(secret + ":" + window). The server
 * accepts the current window or the immediately previous one (so a scan
 * that starts just as the code flips still works); anything older — e.g. a
 * screenshot taken a minute ago — fails. The secret is a parameter here so
 * this module stays pure and unit-testable; only server API routes ever
 * call these functions with a real secret.
 */
export const QR_WINDOW_SECONDS = 15;
export const QR_CODE_LENGTH = 6;

export function qrWindowIndex(at: Date, windowSeconds = QR_WINDOW_SECONDS): number {
  return Math.floor(at.getTime() / 1000 / windowSeconds);
}

export function qrCodeForWindow(secret: string, windowIndex: number): string {
  return createHash("sha256")
    .update(`${secret}:${windowIndex}`)
    .digest("hex")
    .slice(0, QR_CODE_LENGTH)
    .toUpperCase();
}

export interface QrPayload {
  v: 1;
  /** Session id. */
  s: string;
  /** 15-second window index. */
  w: number;
  /** 6-character code for that window. */
  c: string;
}

export function encodeQrPayload(payload: QrPayload): string {
  return JSON.stringify(payload);
}

export function decodeQrPayload(raw: string): QrPayload | null {
  try {
    const parsed: unknown = JSON.parse(raw.trim());
    if (typeof parsed !== "object" || parsed === null) return null;
    const p = parsed as Record<string, unknown>;
    if (p.v !== 1 || typeof p.s !== "string" || typeof p.w !== "number" || typeof p.c !== "string") {
      return null;
    }
    return { v: 1, s: p.s, w: p.w, c: p.c.toUpperCase() };
  } catch {
    return null;
  }
}

/** Build the payload a teacher's screen shows for "now". */
export function currentQrPayload(sessionId: string, secret: string, now = new Date()): QrPayload {
  const w = qrWindowIndex(now);
  return { v: 1, s: sessionId, w, c: qrCodeForWindow(secret, w) };
}

export type TokenCheck =
  | { ok: true; window: number }
  | { ok: false; reason: "expired" | "wrong-session" | "malformed" };

/**
 * Validate a scanned payload server-side. Accepts the current window or
 * the immediately previous one; anything else is "expired" — this is what
 * makes a shared screenshot fail.
 */
export function validateQrToken(
  secret: string,
  payload: QrPayload | null,
  sessionId: string,
  now = new Date(),
): TokenCheck {
  if (!payload) return { ok: false, reason: "malformed" };
  if (payload.s !== sessionId) return { ok: false, reason: "wrong-session" };
  const current = qrWindowIndex(now);
  for (const w of [current, current - 1]) {
    if (payload.w === w && payload.c === qrCodeForWindow(secret, w)) {
      return { ok: true, window: w };
    }
  }
  return { ok: false, reason: "expired" };
}

/** Seconds until the current window flips (for the countdown on screen). */
export function secondsToNextWindow(now = new Date(), windowSeconds = QR_WINDOW_SECONDS): number {
  const elapsed = Math.floor(now.getTime() / 1000) % windowSeconds;
  return windowSeconds - elapsed;
}
