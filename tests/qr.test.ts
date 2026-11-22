import { describe, it, expect } from "vitest";
import {
  QR_WINDOW_SECONDS,
  currentQrPayload,
  decodeQrPayload,
  encodeQrPayload,
  qrCodeForWindow,
  qrWindowIndex,
  secondsToNextWindow,
  validateQrToken,
} from "../lib/qr";

const SECRET = "test-session-secret";
const SESSION = "11111111-2222-3333-4444-555555555555";
const NOW = new Date("2026-11-20T10:00:07.000Z");

describe("qrWindowIndex / qrCodeForWindow", () => {
  it("splits time into 15-second windows", () => {
    expect(QR_WINDOW_SECONDS).toBe(15);
    expect(qrWindowIndex(new Date("2026-11-20T10:00:00.000Z"))).toBe(
      qrWindowIndex(new Date("2026-11-20T10:00:14.999Z")),
    );
    expect(qrWindowIndex(new Date("2026-11-20T10:00:15.000Z"))).toBe(
      qrWindowIndex(new Date("2026-11-20T10:00:00.000Z")) + 1,
    );
  });

  it("is deterministic per window and changes next window", () => {
    const w = qrWindowIndex(NOW);
    expect(qrCodeForWindow(SECRET, w)).toBe(qrCodeForWindow(SECRET, w));
    expect(qrCodeForWindow(SECRET, w)).not.toBe(qrCodeForWindow(SECRET, w + 1));
    expect(qrCodeForWindow(SECRET, w)).toMatch(/^[0-9A-F]{6}$/);
  });

  it("different secrets give different codes", () => {
    const w = qrWindowIndex(NOW);
    expect(qrCodeForWindow(SECRET, w)).not.toBe(qrCodeForWindow("another-secret", w));
  });
});

describe("encode/decode payload", () => {
  it("round-trips", () => {
    const p = currentQrPayload(SESSION, SECRET, NOW);
    expect(decodeQrPayload(encodeQrPayload(p))).toEqual(p);
  });

  it("rejects garbage, wrong shapes and wrong versions", () => {
    expect(decodeQrPayload("not json")).toBeNull();
    expect(decodeQrPayload(JSON.stringify({ v: 2, s: SESSION, w: 1, c: "ABCDEF" }))).toBeNull();
    expect(decodeQrPayload(JSON.stringify({ v: 1, s: SESSION, w: "x", c: "ABCDEF" }))).toBeNull();
    expect(decodeQrPayload(JSON.stringify({ v: 1, s: SESSION, w: 1 }))).toBeNull();
  });
});

describe("validateQrToken", () => {
  it("accepts the current window", () => {
    const p = currentQrPayload(SESSION, SECRET, NOW);
    expect(validateQrToken(SECRET, p, SESSION, NOW)).toEqual({ ok: true, window: qrWindowIndex(NOW) });
  });

  it("accepts the immediately previous window (scan started as code flipped)", () => {
    const prev = new Date(NOW.getTime() - 15000);
    const p = currentQrPayload(SESSION, SECRET, prev);
    expect(validateQrToken(SECRET, p, SESSION, NOW).ok).toBe(true);
  });

  it("rejects a screenshot from two windows ago — the proxy test", () => {
    const old = new Date(NOW.getTime() - 45000);
    const p = currentQrPayload(SESSION, SECRET, old);
    expect(validateQrToken(SECRET, p, SESSION, NOW)).toEqual({ ok: false, reason: "expired" });
  });

  it("rejects a code from another session and a tampered code", () => {
    const other = currentQrPayload("99999999-8888-7777-6666-555555555555", SECRET, NOW);
    expect(validateQrToken(SECRET, other, SESSION, NOW)).toEqual({ ok: false, reason: "wrong-session" });
    const p = currentQrPayload(SESSION, SECRET, NOW);
    expect(validateQrToken(SECRET, { ...p, c: "ZZZZZZ" }, SESSION, NOW)).toEqual({ ok: false, reason: "expired" });
    expect(validateQrToken(SECRET, null, SESSION, NOW)).toEqual({ ok: false, reason: "malformed" });
  });

  it("secondsToNextWindow is within 1..15", () => {
    const s = secondsToNextWindow(NOW);
    expect(s).toBeGreaterThanOrEqual(1);
    expect(s).toBeLessThanOrEqual(15);
    expect(secondsToNextWindow(new Date("2026-11-20T10:00:00.000Z"))).toBe(15);
  });
});
