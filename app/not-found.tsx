import Link from "next/link";

export default function NotFound() {
  return (
    <div className="card">
      <h1>Page not found</h1>
      <p>This page does not exist.</p>
      <Link className="btn" href="/">Go home</Link>
    </div>
  );
}
