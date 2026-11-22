import Link from "next/link";

export default function Nav() {
  return (
    <nav className="nav">
      <Link className="brand" href="/">QR Attendance</Link>
      <Link href="/dashboard">Dashboard</Link>
      <Link href="/scan">Scan QR</Link>
      <Link href="/classes">Classes</Link>
      <Link href="/sessions/new">New Session</Link>
      <Link href="/reports">Reports</Link>
      <span style={{ flex: 1 }} />
      <Link href="/login">Sign in</Link>
      <Link href="/signup">Sign up</Link>
    </nav>
  );
}
