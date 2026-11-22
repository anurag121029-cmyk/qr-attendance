"use client";
import { useEffect, useState } from "react";
export default function ServiceWorker() {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    setOffline(!navigator.onLine);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  if (!offline) return null;
  return (
    <div role="status" className="notice" style={{ position: "fixed", top: 10, right: 10, zIndex: 50 }}>
      You are offline. Scanning and attendance need a connection.
    </div>
  );
}
