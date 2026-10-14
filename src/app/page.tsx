import Link from "next/link";
import { getDashboardSummary, getResourceUsage, listReservations } from "@/lib/services/reservations";
import { addDays, formatDateTime, formatTime, localDateString, localDayStart } from "@/lib/time";

export const dynamic = "force-dynamic";

function barClass(percent: number) {
  if (percent >= 85) return "bar full";
  if (percent >= 60) return "bar hot";
  return "bar";
}

export default async function DashboardPage() {
  const today = localDateString(new Date());
  const [summary, usage, upcoming] = await Promise.all([
    getDashboardSummary(),
    getResourceUsage(),
    listReservations({ status: "confirmed", when: "upcoming", limit: 60 }),
  ]);

  const activeUsage = usage.filter((u) => u.is_active);
  const overall = activeUsage.length
    ? Math.round(activeUsage.reduce((sum, u) => sum + (u.utilization_percent ?? 0), 0) / activeUsage.length)
    : 0;
  const maxUsage = Math.max(1, ...activeUsage.map((u) => u.utilization_percent ?? 0));
  const topUsage = [...activeUsage].sort((a, b) => (b.utilization_percent ?? 0) - (a.utilization_percent ?? 0)).slice(0, 7);

  const dayStart = localDayStart(today);
  const dayEnd = localDayStart(addDays(today, 1));
  const todays = upcoming.filter((r) => r.start_time < dayEnd && r.end_time > dayStart);
  const later = upcoming.filter((r) => r.start_time >= dayEnd).slice(0, 6);

  return (
    <>
      <section className="hero">
        <div className="hero-text">
          <span className="eyebrow"><i /> Live overview</span>
          <h1>Book smarter.<br /><span className="grad">Never double-book.</span></h1>
          <p className="muted">
            Every room, vehicle and device in one place. See what is free right now and reserve it in seconds.
          </p>
          <div className="hero-actions">
            <Link href="/reservations/new" className="btn btn-lg">+ New reservation <span className="arrow">→</span></Link>
            <Link href="/resources" className="btn btn-ghost btn-lg">Browse resources</Link>
          </div>
        </div>
        <div className="hero-art" aria-hidden>
          <div className="hero-ring" />
          <div className="hero-chip c1"><b>{summary.todayReservations}</b> today</div>
          <div className="hero-chip c2"><b>{summary.activeResources}</b> resources</div>
          <div className="hero-chip c3"><b>0</b> conflicts</div>
        </div>
      </section>

      <div className="grid grid-4" style={{ marginBottom: 20 }}>
        <div className="card stat"><div className="stat-icon">▣</div><div className="num">{summary.activeResources}</div><div className="label">Bookable resources</div></div>
        <div className="card stat"><div className="stat-icon">◷</div><div className="num">{summary.todayReservations}</div><div className="label">Reservations today</div></div>
        <div className="card stat"><div className="stat-icon">↗</div><div className="num">{summary.upcomingReservations}</div><div className="label">Upcoming reservations</div></div>
        <div className="card stat"><div className="stat-icon">✕</div><div className="num">{summary.cancelledLast30d}</div><div className="label">Cancelled (30 days)</div></div>
      </div>

      <div className="grid grid-2" style={{ marginBottom: 20, alignItems: "stretch", gridTemplateColumns: "minmax(240px, 1fr) 2fr" }}>
        <section className="card">
          <h2>Overall utilisation</h2>
          <div className="ring-wrap">
            <div className="ring-box">
              <div className="ring" style={{ ["--p" as string]: overall }} />
              <div className="ring-center"><b>{overall}%</b><span>last 30 days</span></div>
            </div>
            <p className="small muted" style={{ textAlign: "center" }}>Average across {activeUsage.length} bookable resources.</p>
          </div>
        </section>
        <section className="card">
          <h2>Most used resources</h2>
          <div className="pills">
            {topUsage.map((u) => (
              <div className="pill-col" key={u.resource_id} title={`${u.name}: ${u.utilization_percent ?? 0}%`}>
                <span className="pill-val">{u.utilization_percent ?? 0}%</span>
                <div className="pill-track"><div className="pill-fill" style={{ height: `${Math.max(((u.utilization_percent ?? 0) / maxUsage) * 100, 6)}%` }} /></div>
                <span className="pill-label">{u.name.split(" ")[0]}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid grid-2" style={{ marginBottom: 20, alignItems: "start" }}>
        <section className="card">
          <h2>Today’s schedule</h2>
          {todays.length === 0 ? (
            <div className="empty">Nothing booked today.</div>
          ) : (
            <div className="table-wrap">
              <table>
                <tbody>
                  {todays.map((r) => (
                    <tr key={r.id}>
                      <td style={{ whiteSpace: "nowrap" }}><strong>{formatTime(r.start_time)}–{formatTime(r.end_time)}</strong></td>
                      <td>
                        <Link href={`/resources/${r.resource_id}?date=${today}`}>{r.resource_name}</Link>
                        <div className="small muted">{r.title} · {r.user_name}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card">
          <h2>Coming up</h2>
          {later.length === 0 ? (
            <div className="empty">No upcoming reservations beyond today.</div>
          ) : (
            <div className="table-wrap">
              <table>
                <tbody>
                  {later.map((r) => (
                    <tr key={r.id}>
                      <td style={{ whiteSpace: "nowrap" }}>{formatDateTime(r.start_time)}</td>
                      <td>
                        <strong>{r.resource_name}</strong>
                        <div className="small muted">{r.title} · {r.user_name}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <section className="card">
        <h2>Resource usage · last 30 days</h2>
        <p className="small muted">Utilisation = booked hours ÷ total opening hours in the period.</p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Resource</th>
                <th>Status</th>
                <th>Reservations</th>
                <th>Booked hours</th>
                <th style={{ minWidth: 160 }}>Utilisation</th>
              </tr>
            </thead>
            <tbody>
              {usage.map((u) => (
                <tr key={u.resource_id} className={u.is_active ? "" : "inactive"}>
                  <td>
                    <Link href={`/resources/${u.resource_id}`}><strong>{u.name}</strong></Link>
                    <div className="small muted">{u.type_name}</div>
                  </td>
                  <td>
                    {!u.is_active ? <span className="badge badge-grey">Disabled</span>
                      : u.in_use_now ? <span className="badge badge-live">In use now</span>
                      : <span className="badge">Free now</span>}
                  </td>
                  <td>{u.reservations_30d}</td>
                  <td>{u.booked_hours_30d} h</td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div className={barClass(u.utilization_percent ?? 0)} style={{ flex: 1 }}>
                        <span style={{ width: `${u.utilization_percent ?? 0}%` }} />
                      </div>
                      <span className="small">{u.utilization_percent ?? 0}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
