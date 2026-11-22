"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("student");
  const [rollNo, setRollNo] = useState("");
  const [department, setDepartment] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
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
    const { error } = await sb.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, role, roll_no: rollNo || null, department: department || null },
      },
    });
    setBusy(false);
    if (error) setError(error.message);
    else setDone(true);
  }

  if (done) {
    return (
      <div className="card" style={{ maxWidth: 480 }}>
        <h1>Check your email</h1>
        <p>
          Account created. If email confirmation is on in your Supabase
          project, confirm the link in your inbox, then <Link href="/login">sign in</Link>.
          (If confirmation is off, you can sign in right away.)
        </p>
        <button className="btn btn-secondary" onClick={() => router.push("/login")}>Go to sign in</button>
      </div>
    );
  }

  return (
    <div className="card" style={{ maxWidth: 480 }}>
      <h1>Sign up</h1>
      <form onSubmit={submit}>
        <label htmlFor="full_name">Full name</label>
        <input id="full_name" className="input" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
        <label htmlFor="email">Email</label>
        <input id="email" className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <label htmlFor="password">Password</label>
        <input id="password" className="input" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
        <label htmlFor="role">I am a</label>
        <select id="role" className="input" value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="student">Student</option>
          <option value="teacher">Teacher</option>
        </select>
        <p className="muted">Admin accounts are promoted by an admin with SQL — see README.</p>
        {role === "student" && (
          <>
            <label htmlFor="roll_no">Roll number</label>
            <input id="roll_no" className="input" value={rollNo} onChange={(e) => setRollNo(e.target.value)} placeholder="e.g. 25/CSE/63" />
          </>
        )}
        <label htmlFor="department">Department</label>
        <input id="department" className="input" value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="e.g. CSE" />
        {error && <p className="error">{error}</p>}
        <div style={{ marginTop: "1rem" }}>
          <button className="btn" type="submit" disabled={busy}>{busy ? "Creating…" : "Create account"}</button>
        </div>
      </form>
      <p className="muted">Already have an account? <Link href="/login">Sign in</Link></p>
    </div>
  );
}
