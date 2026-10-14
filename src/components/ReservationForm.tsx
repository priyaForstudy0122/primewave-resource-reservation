"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  formatDateTime,
  formatDuration,
  formatTime,
  localDateString,
  parseLocalInput,
  toLocalInputValue,
} from "@/lib/time";

interface ResourceOption {
  id: number;
  name: string;
  type_name: string;
  capacity: number;
  open_time: string;
  close_time: string;
  max_duration_minutes: number;
}

interface FreeSlot {
  start: string;
  end: string;
  minutes: number;
}

interface Suggestion {
  start: string;
  end: string;
}

interface Props {
  resources: ResourceOption[];
  defaultResourceId?: number;
  defaultDate?: string;
}

export default function ReservationForm({ resources, defaultResourceId, defaultDate }: Props) {
  const router = useRouter();
  const [resourceId, setResourceId] = useState<number>(defaultResourceId ?? resources[0]?.id ?? 0);
  const [date, setDate] = useState(defaultDate ?? localDateString(new Date()));
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [freeSlots, setFreeSlots] = useState<FreeSlot[] | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [conflictInfo, setConflictInfo] = useState<{ title: string; start: string; end: string } | null>(null);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);

  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [team, setTeam] = useState("");

  const resource = resources.find((r) => r.id === resourceId);

  // Remember who the person is, so repeat bookings are quick.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("reservation-user") ?? "{}");
      if (saved.userName) setUserName(saved.userName);
      if (saved.userEmail) setUserEmail(saved.userEmail);
      if (saved.team) setTeam(saved.team);
    } catch {
      /* ignore corrupt storage */
    }
  }, []);

  // Live availability for the chosen resource + day.
  useEffect(() => {
    if (!resourceId || !date) return;
    const controller = new AbortController();
    setFreeSlots(null);
    fetch(`/api/resources/${resourceId}/availability?date=${date}`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setFreeSlots(data ? data.freeSlots : null))
      .catch(() => undefined);
    return () => controller.abort();
  }, [resourceId, date]);

  function pickSlot(slot: FreeSlot) {
    const start = new Date(slot.start);
    const wanted = Math.min(slot.minutes, 60, resource?.max_duration_minutes ?? 60);
    const end = new Date(start.getTime() + wanted * 60_000);
    setStartTime(toLocalInputValue(start).slice(11));
    setEndTime(toLocalInputValue(end).slice(11));
    setError(null);
    setSuggestion(null);
    setConflictInfo(null);
  }

  function applySuggestion(s: Suggestion) {
    const start = new Date(s.start);
    const end = new Date(s.end);
    setDate(localDateString(start));
    setStartTime(toLocalInputValue(start).slice(11));
    setEndTime(toLocalInputValue(end).slice(11));
    setError(null);
    setSuggestion(null);
    setConflictInfo(null);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setSuggestion(null);
    setConflictInfo(null);

    const start = parseLocalInput(`${date}T${startTime}`);
    const end = parseLocalInput(`${date}T${endTime}`);
    if (!start || !end) {
      setError("Please choose a valid date and time.");
      return;
    }

    const f = new FormData(e.currentTarget);
    setBusy(true);
    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resourceId,
          title: f.get("title"),
          notes: f.get("notes"),
          attendees: f.get("attendees"),
          startTime: start.toISOString(),
          endTime: end.toISOString(),
          userName,
          userEmail,
          team,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Could not create the reservation");
        setFieldErrors(body.fieldErrors ?? {});
        if (res.status === 409 && body.details) {
          setSuggestion(body.details.suggestedSlot ?? null);
          setConflictInfo(body.details.conflictingReservation ?? null);
        }
        return;
      }
      try {
        localStorage.setItem("reservation-user", JSON.stringify({ userName, userEmail, team }));
      } catch {
        /* storage unavailable - not critical */
      }
      router.push(`/resources/${resourceId}?date=${date}&booked=${body.id}`);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const err = (k: string) => fieldErrors[k] && <div className="field-error">{fieldErrors[k]}</div>;

  return (
    <form onSubmit={onSubmit} className="card" style={{ maxWidth: 760 }}>
      {error && (
        <div className="alert alert-error">
          <strong>{error}</strong>
          {conflictInfo && (
            <div className="small">
              Existing booking: “{conflictInfo.title}” {formatTime(conflictInfo.start)}–{formatTime(conflictInfo.end)}
            </div>
          )}
          {suggestion && (
            <div style={{ marginTop: 8 }}>
              <span className="small">Next free slot that fits: </span>
              <button type="button" className="chip" onClick={() => applySuggestion(suggestion)}>
                {formatDateTime(suggestion.start)} → {formatTime(suggestion.end)}
              </button>
            </div>
          )}
        </div>
      )}

      <div className="form-row">
        <div className="field">
          <label htmlFor="resourceId">Resource</label>
          <select id="resourceId" value={resourceId} onChange={(e) => setResourceId(Number(e.target.value))} required>
            {resources.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} ({r.type_name})
              </option>
            ))}
          </select>
          {resource && (
            <div className="small muted">
              Open {resource.open_time}–{resource.close_time} · capacity {resource.capacity} · max{" "}
              {formatDuration(resource.max_duration_minutes)}
            </div>
          )}
        </div>
        <div className="field">
          <label htmlFor="date">Date</label>
          <input id="date" type="date" value={date} min={localDateString(new Date())} onChange={(e) => setDate(e.target.value)} required />
        </div>
      </div>

      {resource && (
        <div className="field">
          <label>Free time on this day {freeSlots === null && <span className="muted">(loading…)</span>}</label>
          {freeSlots && freeSlots.length === 0 && <div className="small muted">Fully booked — try another day.</div>}
          <div className="chips">
            {freeSlots?.map((s) => (
              <button type="button" key={s.start} className="chip" onClick={() => pickSlot(s)}>
                {formatTime(s.start)}–{formatTime(s.end)} · {formatDuration(s.minutes)}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="form-row">
        <div className="field">
          <label htmlFor="startTime">Start</label>
          <input
            id="startTime"
            type="time"
            step={900}
            value={startTime}
            min={resource?.open_time}
            max={resource?.close_time}
            onChange={(e) => setStartTime(e.target.value)}
            required
          />
          {err("startTime")}
        </div>
        <div className="field">
          <label htmlFor="endTime">End</label>
          <input id="endTime" type="time" step={900} value={endTime} onChange={(e) => setEndTime(e.target.value)} required />
          {err("endTime")}
        </div>
        <div className="field">
          <label htmlFor="attendees">Attendees</label>
          <input id="attendees" name="attendees" type="number" min={1} defaultValue={1} required />
          {err("attendees")}
        </div>
      </div>

      <div className="field">
        <label htmlFor="title">Title / purpose</label>
        <input id="title" name="title" required placeholder="e.g. Sprint planning" />
        {err("title")}
      </div>

      <div className="form-row">
        <div className="field">
          <label htmlFor="userName">Your name</label>
          <input id="userName" value={userName} onChange={(e) => setUserName(e.target.value)} required />
          {err("userName")}
        </div>
        <div className="field">
          <label htmlFor="userEmail">E-mail</label>
          <input id="userEmail" type="email" value={userEmail} onChange={(e) => setUserEmail(e.target.value)} required />
          {err("userEmail")}
        </div>
        <div className="field">
          <label htmlFor="team">Team (optional)</label>
          <input id="team" value={team} onChange={(e) => setTeam(e.target.value)} />
        </div>
      </div>

      <div className="field">
        <label htmlFor="notes">Notes (optional)</label>
        <textarea id="notes" name="notes" />
      </div>

      <button className="btn" disabled={busy || !resource}>
        {busy ? "Booking…" : "Confirm reservation"}
      </button>
    </form>
  );
}
