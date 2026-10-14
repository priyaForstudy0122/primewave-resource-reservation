import Link from "next/link";
import ResourceToggle from "@/components/ResourceToggle";
import { listResources, listResourceTypes } from "@/lib/services/resources";
import { formatDuration, localDateString } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function ResourcesPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const { type } = await searchParams;
  const [resources, types] = await Promise.all([listResources({ includeInactive: true }), listResourceTypes()]);
  const typeId = Number(type) || undefined;
  const shown = typeId ? resources.filter((r) => r.type_id === typeId) : resources;
  const today = localDateString(new Date());

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Resources</h1>
          <p className="muted">Rooms, vehicles, equipment and anything else people need to share.</p>
        </div>
        <Link href="/resources/new" className="btn">+ Add resource</Link>
      </div>

      <div className="chips" style={{ marginBottom: 18 }}>
        <Link href="/resources" className={`chip ${!typeId ? "chip-active" : ""}`}>All</Link>
        {types.map((t) => (
          <Link key={t.id} href={`/resources?type=${t.id}`} className={`chip ${typeId === t.id ? "chip-active" : ""}`}>
            {t.name}
          </Link>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="card empty">No resources yet. Add the first one.</div>
      ) : (
        <div className="grid grid-3">
          {shown.map((r) => (
            <div key={r.id} className={`card res-card ${r.is_active ? "" : "inactive"}`}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <h3>{r.name}</h3>
                <span className={`badge ${r.is_active ? "" : "badge-grey"}`}>{r.is_active ? r.type_name : "Disabled"}</span>
              </div>
              {r.description && <p className="small muted">{r.description}</p>}
              <div className="res-meta">
                {r.location && <span>📍 {r.location}</span>}
                <span>👥 {r.capacity}</span>
                <span>🕗 {r.open_time}–{r.close_time}</span>
                <span>⏱ max {formatDuration(r.max_duration_minutes)}</span>
              </div>
              <div className="res-actions">
                <Link href={`/resources/${r.id}?date=${today}`} className="btn btn-sm">Availability</Link>
                {r.is_active && <Link href={`/reservations/new?resourceId=${r.id}`} className="btn btn-ghost btn-sm">Book</Link>}
                <Link href={`/resources/${r.id}/edit`} className="btn btn-ghost btn-sm">Edit</Link>
                <ResourceToggle id={r.id} isActive={r.is_active} />
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
