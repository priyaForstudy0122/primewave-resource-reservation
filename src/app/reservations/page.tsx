import Link from "next/link";
import CancelButton from "@/components/CancelButton";
import { listResources } from "@/lib/services/resources";
import { listReservations } from "@/lib/services/reservations";
import { formatDateTime, formatDuration, formatTime } from "@/lib/time";

export const dynamic = "force-dynamic";

type SP = { resourceId?: string; status?: string; when?: string; q?: string };

export default async function ReservationsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const when = sp.when === "past" || sp.when === "all" ? sp.when : "upcoming";
  const status = sp.status === "confirmed" || sp.status === "cancelled" ? sp.status : undefined;

  const [resources, reservations] = await Promise.all([
    listResources({ includeInactive: true }),
    listReservations({
      resourceId: Number(sp.resourceId) || undefined,
      status,
      when,
      search: sp.q?.trim() || undefined,
    }),
  ]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Reservations</h1>
          <p className="muted">Every booking, with filters. Cancelled slots are released immediately.</p>
        </div>
        <Link href="/reservations/new" className="btn">+ New reservation</Link>
      </div>

      <form className="filters card" method="get">
        <div className="field">
          <label htmlFor="resourceId">Resource</label>
          <select id="resourceId" name="resourceId" defaultValue={sp.resourceId ?? ""}>
            <option value="">All resources</option>
            {resources.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="when">When</label>
          <select id="when" name="when" defaultValue={when}>
            <option value="upcoming">Upcoming</option>
            <option value="past">Past</option>
            <option value="all">All</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="status">Status</label>
          <select id="status" name="status" defaultValue={status ?? ""}>
            <option value="">Any</option>
            <option value="confirmed">Confirmed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label htmlFor="q">Search</label>
          <input id="q" name="q" placeholder="Title, name or e-mail" defaultValue={sp.q ?? ""} />
        </div>
        <button className="btn">Apply</button>
        <Link href="/reservations" className="btn btn-ghost">Reset</Link>
      </form>

      <div className="card">
        {reservations.length === 0 ? (
          <div className="empty">No reservations match these filters.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>When</th><th>Resource</th><th>Booked by</th><th>Status</th><th /></tr>
              </thead>
              <tbody>
                {reservations.map((r) => {
                  const minutes = (r.end_time.getTime() - r.start_time.getTime()) / 60_000;
                  const isPast = r.end_time.getTime() < Date.now();
                  return (
                    <tr key={r.id} className={r.status === "cancelled" ? "cancelled" : ""}>
                      <td style={{ whiteSpace: "nowrap" }}>
                        <strong>{formatDateTime(r.start_time)}</strong>
                        <div className="small muted">→ {formatTime(r.end_time)} ({formatDuration(minutes)})</div>
                      </td>
                      <td>
                        <Link href={`/resources/${r.resource_id}`}>{r.resource_name}</Link>
                        <div className="small muted title">{r.title}</div>
                      </td>
                      <td>
                        {r.user_name}
                        <div className="small muted">{r.team ? `${r.team} · ` : ""}{r.user_email}</div>
                      </td>
                      <td>
                        {r.status === "cancelled" ? <span className="badge badge-red">Cancelled</span>
                          : isPast ? <span className="badge badge-grey">Completed</span>
                          : <span className="badge">Confirmed</span>}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {r.status === "confirmed" && !isPast && <CancelButton id={r.id} title={r.title} />}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
