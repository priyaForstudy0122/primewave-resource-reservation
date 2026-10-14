import type { DayAvailability } from "@/lib/services/reservations";
import { formatDuration, formatTime, minutesToHHMM } from "@/lib/time";

/** Horizontal day view: the bar spans opening → closing, each booking is a block. */
export default function Timeline({ day }: { day: DayAvailability }) {
  const span = day.closeMinutes - day.openMinutes;
  const pct = (minutes: number) => ((Math.min(Math.max(minutes, day.openMinutes), day.closeMinutes) - day.openMinutes) / span) * 100;

  const hourMarks: number[] = [];
  for (let m = Math.ceil(day.openMinutes / 60) * 60; m <= day.closeMinutes; m += 60) hourMarks.push(m);
  const hourWidth = `${(60 / span) * 100}%`;

  return (
    <div>
      <div className="timeline" style={{ ["--hour-w" as string]: hourWidth }}>
        {day.reservations.map((r) => {
          const left = pct(r.startMinutes);
          const width = pct(r.endMinutes) - left;
          return (
            <div
              key={r.id}
              className="timeline-block"
              style={{ left: `${left}%`, width: `${Math.max(width, 1)}%` }}
              title={`${r.title} — ${r.userName} (${formatTime(r.start)}–${formatTime(r.end)})`}
            >
              <b>{r.title}</b>
              {formatTime(r.start)}–{formatTime(r.end)}
            </div>
          );
        })}
      </div>
      <div className="timeline-scale">
        {hourMarks.filter((_, i, a) => a.length <= 12 || i % 2 === 0).map((m) => (
          <span key={m}>{minutesToHHMM(m)}</span>
        ))}
      </div>
      <p className="small muted" style={{ marginTop: 10 }}>
        Booked {formatDuration(day.bookedMinutes)} of {formatDuration(span)} · {day.utilizationPercent}% utilised
      </p>
    </div>
  );
}
