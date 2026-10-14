"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ResourceToggle({ id, isActive }: { id: number; isActive: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    await fetch(`/api/resources/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !isActive }),
    });
    setBusy(false);
    router.refresh();
  }

  return (
    <button className="btn btn-ghost btn-sm" onClick={toggle} disabled={busy}>
      {isActive ? "Disable" : "Enable"}
    </button>
  );
}
