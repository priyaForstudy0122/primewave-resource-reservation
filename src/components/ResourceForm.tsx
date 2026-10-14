"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface Props {
  types: { id: number; name: string }[];
  /** When provided the form edits this resource, otherwise it creates one. */
  initial?: {
    id: number;
    name: string;
    type_id: number;
    location: string | null;
    description: string | null;
    capacity: number;
    open_time: string;
    close_time: string;
    max_duration_minutes: number;
    is_active: boolean;
  };
}

export default function ResourceForm({ types, initial }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setFieldErrors({});
    const f = new FormData(e.currentTarget);
    const payload = {
      name: f.get("name"),
      typeId: f.get("typeId"),
      location: f.get("location"),
      description: f.get("description"),
      capacity: f.get("capacity"),
      openTime: f.get("openTime"),
      closeTime: f.get("closeTime"),
      maxDurationMinutes: f.get("maxDurationMinutes"),
      isActive: f.get("isActive") === "on",
    };
    try {
      const res = await fetch(initial ? `/api/resources/${initial.id}` : "/api/resources", {
        method: initial ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Could not save");
        setFieldErrors(body.fieldErrors ?? {});
        return;
      }
      router.push(`/resources/${body.id}`);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const err = (k: string) => fieldErrors[k] && <div className="field-error">{fieldErrors[k]}</div>;

  return (
    <form onSubmit={onSubmit} className="card" style={{ maxWidth: 720 }}>
      {error && <div className="alert alert-error">{error}</div>}

      <div className="form-row">
        <div className="field">
          <label htmlFor="name">Name</label>
          <input id="name" name="name" required defaultValue={initial?.name} placeholder="e.g. Boardroom Alpha" />
          {err("name")}
        </div>
        <div className="field">
          <label htmlFor="typeId">Type</label>
          <select id="typeId" name="typeId" required defaultValue={initial?.type_id ?? ""}>
            <option value="" disabled>Select type…</option>
            {types.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          {err("typeId")}
        </div>
      </div>

      <div className="form-row">
        <div className="field">
          <label htmlFor="location">Location</label>
          <input id="location" name="location" defaultValue={initial?.location ?? ""} placeholder="Floor 3" />
        </div>
        <div className="field">
          <label htmlFor="capacity">Capacity (people / units)</label>
          <input id="capacity" name="capacity" type="number" min={1} required defaultValue={initial?.capacity ?? 1} />
          {err("capacity")}
        </div>
      </div>

      <div className="field">
        <label htmlFor="description">Description</label>
        <textarea id="description" name="description" defaultValue={initial?.description ?? ""} />
      </div>

      <div className="form-row">
        <div className="field">
          <label htmlFor="openTime">Opens</label>
          <input id="openTime" name="openTime" type="time" required defaultValue={initial?.open_time ?? "08:00"} />
          {err("openTime")}
        </div>
        <div className="field">
          <label htmlFor="closeTime">Closes</label>
          <input id="closeTime" name="closeTime" type="time" required defaultValue={initial?.close_time ?? "18:00"} />
          {err("closeTime")}
        </div>
        <div className="field">
          <label htmlFor="maxDurationMinutes">Max booking (minutes)</label>
          <input
            id="maxDurationMinutes"
            name="maxDurationMinutes"
            type="number"
            min={15}
            step={15}
            required
            defaultValue={initial?.max_duration_minutes ?? 240}
          />
          {err("maxDurationMinutes")}
        </div>
      </div>

      <div className="field">
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 500 }}>
          <input type="checkbox" name="isActive" defaultChecked={initial?.is_active ?? true} style={{ width: "auto" }} />
          Available for booking
        </label>
      </div>

      <button className="btn" disabled={busy}>{busy ? "Saving…" : initial ? "Save changes" : "Create resource"}</button>
    </form>
  );
}
