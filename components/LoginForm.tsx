"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const sb = createClient();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!sb) {
      setError("Supabase is not configured. Add keys to .env.local (see README).");
      return;
    }
    setBusy(true);
    const { error } = await sb.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) setError(error.message);
    else router.push(params.get("next") || "/dashboard");
  }

  return (
    <div className="card" style={{ maxWidth: 480 }}>
      <h1>Sign in</h1>
      <form onSubmit={submit}>
        <label htmlFor="email">Email</label>
        <input id="email" className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <label htmlFor="password">Password</label>
        <input id="password" className="input" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <p className="error">{error}</p>}
        <div style={{ marginTop: "1rem" }}>
          <button className="btn" type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
        </div>
      </form>
      <p className="muted">No account yet? <Link href="/signup">Sign up</Link></p>
    </div>
  );
}
