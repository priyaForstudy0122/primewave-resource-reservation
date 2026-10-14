"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function CancelButton({ id, title }: { id: number; title: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cancel() {
    if (!window.confirm(`Cancel "${title}"? The slot becomes available to others.`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/reservations/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Could not cancel");
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not cancel");
      setBusy(false);
    }
  }

  return (
    <>
      <button className="btn btn-danger btn-sm" onClick={cancel} disabled={busy}>
        {busy ? "Cancelling…" : "Cancel"}
      </button>
      {error && <div className="field-error">{error}</div>}
    </>
  );
}
