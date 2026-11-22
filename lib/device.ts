/** One stable device id per browser (localStorage). Used so one phone
 * cannot mark attendance for two different students in the same session.
 * Server-side the id is just an opaque string; it is never a login. */
const KEY = "qr-attendance-device-id";

export function getOrCreateDeviceId(): string {
  try {
    const existing = localStorage.getItem(KEY);
    if (existing) return existing;
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `device-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(KEY, id);
    return id;
  } catch {
    return `device-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}
