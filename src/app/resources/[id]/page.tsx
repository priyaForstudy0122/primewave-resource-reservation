import Link from "next/link";
import { notFound } from "next/navigation";
import CancelButton from "@/components/CancelButton";
import Timeline from "@/components/Timeline";
import { AppError } from "@/lib/errors";
import { getResource } from "@/lib/services/resources";
import { getDayAvailability } from "@/lib/services/reservations";
import { addDays, formatDuration, formatTime, localDateString } from "@/lib/time";
import { dateParamSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export default async function ResourceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ date?: string; booked?: string }>;
}) {
  const id = Number((await params).id);
  const sp = await searchParams;
  if (!Number.isInteger(id)) notFound();

  const parsed = dateParamSchema.safeParse(sp.date);
  const date = parsed.success ? parsed.data : localDateString(new Date());

  let resource;
  try {
    resource = await getResource(id);
  } catch (e) {
    if (e instanceof AppError && e.status === 404) notFound();
    throw e;
  }
  const day = await getDayAvailability(id, date);
  const prettyDate = new Intl.DateTimeFormat("en-GB", { dateStyle: "full", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));

  return (
    <>
      <div className="page-head">
        <div>
          <p className="small"><Link href="/resources">← All resources</Link></p>
          <h1>{resource.name} {!resource.is_active && <span className="badge badge-grey">Disabled</span>}</h1>
          <p className="muted">
            {resource.type_name}{resource.location ? ` · ${resource.location}` : ""} · capacity {resource.capacity} · open {resource.open_time}–{resource.close_time} · max {formatDuration(resource.max_duration_minutes)}
          </p>
        </div>
        {resource.is_active && (
          <Link href={`/reservations/new?resourceId=${resource.id}&date=${date}`} className="btn">+ Book this resource</Link>
        )}
      </div>

      {sp.booked && <div className="alert alert-ok">✅ Reservation #{sp.booked} confirmed.</div>}

      <section className="card" style={{ marginBottom: 20 }}>
        <div className="page-head" style={{ marginBottom: 14 }}>
          <h2 style={{ margin: 0 }}>{prettyDate}</h2>
          <div className="day-nav">
            <Link className="btn btn-ghost btn-sm" href={`/resources/${id}?date=${addDays(date, -1)}`}>← Prev</Link>
            <Link className="btn btn-ghost btn-sm" href={`/resources/${id}?date=${localDateString(new Date())}`}>Today</Link>
            <Link className="btn btn-ghost btn-sm" href={`/resources/${id}?date=${addDays(date, 1)}`}>Next →</Link>
          </div>
        </div>
        <Timeline day={day} />
      </section>

      <div className="grid grid-2" style={{ alignItems: "start" }}>
        <section className="card">
          <h2>Free slots</h2>
          {day.freeSlots.length === 0 ? (
            <p className="muted">Fully booked on this day.</p>
          ) : (
            <div className="chips">
              {day.freeSlots.map((s) => (
                <span key={s.start} className="chip chip-static">
                  {formatTime(s.start)}–{formatTime(s.end)} · {formatDuration(s.minutes)}
                </span>
              ))}
            </div>
          )}
        </section>

        <section className="card">
          <h2>Bookings</h2>
          {day.reservations.length === 0 ? (
            <p className="muted">No bookings on this day.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <tbody>
                  {day.reservations.map((r) => (
                    <tr key={r.id}>
                      <td style={{ whiteSpace: "nowrap" }}><strong>{formatTime(r.start)}–{formatTime(r.end)}</strong></td>
                      <td>{r.title}<div className="small muted">{r.userName}</div></td>
                      <td style={{ textAlign: "right" }}><CancelButton id={r.id} title={r.title} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
