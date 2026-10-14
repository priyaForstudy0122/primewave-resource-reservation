import Link from "next/link";

export default function NotFound() {
  return (
    <div className="card empty">
      <h1>Not found</h1>
      <p>That page or record does not exist.</p>
      <Link href="/" className="btn">Back to dashboard</Link>
    </div>
  );
}
