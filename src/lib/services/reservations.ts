import type { PoolClient } from "pg";
import { pool, query } from "../db";
import { AppError, badRequest, conflict, notFound } from "../errors";
import {
  type Interval,
  findNextFreeSlot,
  freeGapsForDay,
  withinOpeningHours,
} from "../slots";
import {
  addDays,
  formatDuration,
  localDateString,
  localDayStart,
  localMinutesOfDay,
  minutesToHHMM,
  parseTimeToMinutes,
} from "../time";
import type { ReservationInput } from "../validation";
import { getResource, type ResourceRow } from "./resources";

export interface ReservationRow {
  id: number;
  resource_id: number;
  resource_name: string;
  type_name: string;
  user_name: string;
  user_email: string;
  team: string | null;
  title: string;
  notes: string | null;
  attendees: number;
  start_time: Date;
  end_time: Date;
  status: "confirmed" | "cancelled";
  cancelled_at: Date | null;
}

const SELECT_RESERVATION = `
  SELECT rv.id, rv.resource_id, r.name AS resource_name, t.name AS type_name,
         u.name AS user_name, u.email AS user_email, u.team,
         rv.title, rv.notes, rv.attendees, rv.start_time, rv.end_time,
         rv.status, rv.cancelled_at
  FROM reservations rv
  JOIN resources r ON r.id = rv.resource_id
  JOIN resource_types t ON t.id = r.type_id
  JOIN users u ON u.id = rv.user_id`;

function hoursOf(resource: ResourceRow) {
  return {
    openMinutes: parseTimeToMinutes(resource.open_time),
    closeMinutes: parseTimeToMinutes(resource.close_time),
  };
}

function pgCode(err: unknown): string | undefined {
  return typeof err === "object" && err !== null ? (err as { code?: string }).code : undefined;
}

/** Confirmed reservations of a resource that end after `from` (used to find free slots). */
async function busyIntervals(resourceId: number, from: Date, until: Date): Promise<Interval[]> {
  const rows = await query<{ start_time: Date; end_time: Date }>(
    `SELECT start_time, end_time FROM reservations
     WHERE resource_id = $1 AND status = 'confirmed' AND end_time > $2 AND start_time < $3
     ORDER BY start_time`,
    [resourceId, from, until],
  );
  return rows.map((r) => ({ start: r.start_time, end: r.end_time }));
}

/**
 * Business-rule checks that are NOT expressible as table constraints.
 * (The overlap rule itself is enforced by the database; see 001_init.sql.)
 */
function assertBookable(resource: ResourceRow, input: ReservationInput, interval: Interval) {
  if (!resource.is_active) throw badRequest(`"${resource.name}" is currently unavailable for booking`);

  const minutes = (interval.end.getTime() - interval.start.getTime()) / 60_000;
  if (minutes > resource.max_duration_minutes) {
    throw badRequest(
      `"${resource.name}" can be booked for at most ${formatDuration(resource.max_duration_minutes)} at a time`,
    );
  }
  if (interval.start.getTime() < Date.now() - 60_000) {
    throw badRequest("Reservations cannot start in the past");
  }
  if (input.attendees > resource.capacity) {
    throw badRequest(`"${resource.name}" holds at most ${resource.capacity} (you entered ${input.attendees})`);
  }
  if (!withinOpeningHours(interval, hoursOf(resource))) {
    throw badRequest(
      `"${resource.name}" can only be booked between ${resource.open_time} and ${resource.close_time} on a single day`,
    );
  }
}

async function upsertUser(client: PoolClient, input: ReservationInput): Promise<number> {
  const { rows } = await client.query<{ id: number }>(
    `INSERT INTO users (name, email, team) VALUES ($1, $2, $3)
     ON CONFLICT (lower(email))
     DO UPDATE SET name = EXCLUDED.name, team = COALESCE(NULLIF(EXCLUDED.team, ''), users.team)
     RETURNING id`,
    [input.userName, input.userEmail, input.team || null],
  );
  return rows[0].id;
}

export async function createReservation(input: ReservationInput): Promise<ReservationRow> {
  const resource = await getResource(input.resourceId);
  const interval: Interval = { start: new Date(input.startTime), end: new Date(input.endTime) };
  assertBookable(resource, input, interval);

  let reservationId: number;
  try {
    reservationId = await insertReservation(resource, input, interval);
  } catch (err) {
    // 23P01 = exclusion_violation -> somebody holds an overlapping slot.
    // NOTE: the connection has already been released here. Building the
    // friendly error needs more queries; doing that while still holding a
    // connection would deadlock the pool under heavy concurrent load.
    if (pgCode(err) === "23P01") throw await buildConflictError(resource, interval);
    throw err;
  }
  return getReservation(reservationId);
}

/** One atomic transaction: upsert the person, insert the booking, write the audit event. */
async function insertReservation(resource: ResourceRow, input: ReservationInput, interval: Interval): Promise<number> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const userId = await upsertUser(client, input);
    const { rows } = await client.query<{ id: number }>(
      `INSERT INTO reservations (resource_id, user_id, title, notes, attendees, start_time, end_time)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [resource.id, userId, input.title, input.notes || null, input.attendees, interval.start, interval.end],
    );
    await client.query("INSERT INTO reservation_events (reservation_id, event_type) VALUES ($1, 'created')", [
      rows[0].id,
    ]);
    await client.query("COMMIT");
    return rows[0].id;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

async function buildConflictError(resource: ResourceRow, interval: Interval): Promise<AppError> {
  const durationMinutes = Math.round((interval.end.getTime() - interval.start.getTime()) / 60_000);
  const lookahead = new Date(interval.start.getTime() + 15 * 24 * 60 * 60_000);
  const busy = await busyIntervals(resource.id, interval.start, lookahead);
  const suggestion = findNextFreeSlot(interval.start, durationMinutes, busy, hoursOf(resource));
  const clashing = await query<{ title: string; start_time: Date; end_time: Date }>(
    `SELECT title, start_time, end_time FROM reservations
     WHERE resource_id = $1 AND status = 'confirmed'
       AND tstzrange(start_time, end_time, '[)') && tstzrange($2, $3, '[)')
     ORDER BY start_time LIMIT 1`,
    [resource.id, interval.start, interval.end],
  );
  return conflict(`"${resource.name}" is already reserved for part of that time`, {
    conflictingReservation: clashing[0]
      ? { title: clashing[0].title, start: clashing[0].start_time, end: clashing[0].end_time }
      : null,
    suggestedSlot: suggestion
      ? { start: suggestion.start.toISOString(), end: suggestion.end.toISOString() }
      : null,
  });
}

export async function getReservation(id: number): Promise<ReservationRow> {
  const rows = await query<ReservationRow>(`${SELECT_RESERVATION} WHERE rv.id = $1`, [id]);
  if (!rows[0]) throw notFound("Reservation");
  return rows[0];
}

export interface ReservationFilters {
  resourceId?: number;
  status?: "confirmed" | "cancelled";
  when?: "upcoming" | "past" | "all";
  search?: string;
  limit?: number;
}

export async function listReservations(filters: ReservationFilters = {}): Promise<ReservationRow[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  const add = (sql: string, value?: unknown) => {
    if (value !== undefined) params.push(value);
    where.push(sql.replace("?", `$${params.length}`));
  };

  if (filters.resourceId) add("rv.resource_id = ?", filters.resourceId);
  if (filters.status) add("rv.status = ?", filters.status);
  if (filters.when === "upcoming") add("rv.end_time >= now()");
  if (filters.when === "past") add("rv.end_time < now()");
  if (filters.search) {
    params.push(`%${filters.search}%`);
    where.push(`(rv.title ILIKE $${params.length} OR u.name ILIKE $${params.length} OR u.email ILIKE $${params.length})`);
  }

  const order = filters.when === "past" ? "rv.start_time DESC" : "rv.start_time ASC";
  params.push(filters.limit ?? 200);
  return query<ReservationRow>(
    `${SELECT_RESERVATION}
     ${where.length ? "WHERE " + where.join(" AND ") : ""}
     ORDER BY ${order} LIMIT $${params.length}`,
    params,
  );
}

export async function cancelReservation(id: number, reason?: string): Promise<ReservationRow> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Row lock so two simultaneous cancels cannot both "succeed".
    const { rows } = await client.query<{ status: string; end_time: Date }>(
      "SELECT status, end_time FROM reservations WHERE id = $1 FOR UPDATE",
      [id],
    );
    if (!rows[0]) throw notFound("Reservation");
    if (rows[0].status === "cancelled") throw conflict("This reservation is already cancelled");
    if (rows[0].end_time.getTime() < Date.now()) throw badRequest("Past reservations cannot be cancelled");

    await client.query("UPDATE reservations SET status='cancelled', cancelled_at=now() WHERE id=$1", [id]);
    await client.query(
      "INSERT INTO reservation_events (reservation_id, event_type, detail) VALUES ($1,'cancelled',$2)",
      [id, reason || null],
    );
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
  return getReservation(id);
}

// ---------------------------------------------------------------------------
// Availability for one resource on one local day (powers the timeline view)
// ---------------------------------------------------------------------------
export interface DayAvailability {
  date: string;
  open: string;
  close: string;
  openMinutes: number;
  closeMinutes: number;
  reservations: Array<{
    id: number;
    title: string;
    userName: string;
    start: string;
    end: string;
    startMinutes: number;
    endMinutes: number;
  }>;
  freeSlots: Array<{ start: string; end: string; minutes: number }>;
  bookedMinutes: number;
  utilizationPercent: number;
}

export async function getDayAvailability(resourceId: number, date: string): Promise<DayAvailability> {
  const resource = await getResource(resourceId);
  const hours = hoursOf(resource);
  const dayStart = localDayStart(date);
  const dayEnd = localDayStart(addDays(date, 1));

  const rows = await query<{ id: number; title: string; user_name: string; start_time: Date; end_time: Date }>(
    `SELECT rv.id, rv.title, u.name AS user_name, rv.start_time, rv.end_time
     FROM reservations rv JOIN users u ON u.id = rv.user_id
     WHERE rv.resource_id = $1 AND rv.status = 'confirmed' AND rv.end_time > $2 AND rv.start_time < $3
     ORDER BY rv.start_time`,
    [resourceId, dayStart, dayEnd],
  );

  const reservations = rows.map((r) => {
    const startMinutes = r.start_time < dayStart ? 0 : localMinutesOfDay(r.start_time);
    const endMinutes = r.end_time >= dayEnd ? 24 * 60 : localMinutesOfDay(r.end_time);
    return {
      id: r.id,
      title: r.title,
      userName: r.user_name,
      start: r.start_time.toISOString(),
      end: r.end_time.toISOString(),
      startMinutes,
      endMinutes,
    };
  });

  const busy = rows.map((r) => ({ start: r.start_time, end: r.end_time }));
  const freeSlots = freeGapsForDay(date, busy, hours).map((g) => ({
    start: g.start.toISOString(),
    end: g.end.toISOString(),
    minutes: Math.round((g.end.getTime() - g.start.getTime()) / 60_000),
  }));

  const openLength = hours.closeMinutes - hours.openMinutes;
  const bookedMinutes = reservations.reduce(
    (sum, r) => sum + Math.max(0, Math.min(r.endMinutes, hours.closeMinutes) - Math.max(r.startMinutes, hours.openMinutes)),
    0,
  );

  return {
    date,
    open: minutesToHHMM(hours.openMinutes),
    close: minutesToHHMM(hours.closeMinutes),
    openMinutes: hours.openMinutes,
    closeMinutes: hours.closeMinutes,
    reservations,
    freeSlots,
    bookedMinutes,
    utilizationPercent: openLength > 0 ? Math.round((bookedMinutes / openLength) * 100) : 0,
  };
}

// ---------------------------------------------------------------------------
// Dashboard / usage statistics
// ---------------------------------------------------------------------------
export interface ResourceUsage {
  resource_id: number;
  name: string;
  type_name: string;
  is_active: boolean;
  reservations_30d: number;
  booked_hours_30d: number;
  utilization_percent: number;
  in_use_now: boolean;
  next_start: Date | null;
}

export async function getResourceUsage(): Promise<ResourceUsage[]> {
  return query<ResourceUsage>(
    `SELECT r.id AS resource_id, r.name, t.name AS type_name, r.is_active,
            COALESCE(u.cnt, 0)::int AS reservations_30d,
            ROUND(COALESCE(u.minutes, 0) / 60.0, 1)::float AS booked_hours_30d,
            LEAST(100, ROUND(100.0 * COALESCE(u.minutes, 0) /
              NULLIF(EXTRACT(EPOCH FROM (r.close_time - r.open_time)) / 60.0 * 30, 0)))::int AS utilization_percent,
            EXISTS (SELECT 1 FROM reservations x WHERE x.resource_id = r.id AND x.status='confirmed'
                    AND x.start_time <= now() AND x.end_time > now()) AS in_use_now,
            (SELECT min(x.start_time) FROM reservations x WHERE x.resource_id = r.id AND x.status='confirmed'
                    AND x.start_time > now()) AS next_start
     FROM resources r
     JOIN resource_types t ON t.id = r.type_id
     LEFT JOIN (
        SELECT resource_id, count(*) AS cnt,
               SUM(EXTRACT(EPOCH FROM (LEAST(end_time, now()) - GREATEST(start_time, now() - interval '30 days'))) / 60.0) AS minutes
        FROM reservations
        WHERE status = 'confirmed' AND start_time < now() AND end_time > now() - interval '30 days'
        GROUP BY resource_id
     ) u ON u.resource_id = r.id
     ORDER BY utilization_percent DESC NULLS LAST, r.name`,
  );
}

export interface DashboardSummary {
  activeResources: number;
  upcomingReservations: number;
  todayReservations: number;
  cancelledLast30d: number;
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const todayStart = localDayStart(localDateString(new Date()));
  const tomorrowStart = localDayStart(addDays(localDateString(new Date()), 1));
  const rows = await query<DashboardSummary>(
    `SELECT
       (SELECT count(*) FROM resources WHERE is_active)::int AS "activeResources",
       (SELECT count(*) FROM reservations WHERE status='confirmed' AND end_time >= now())::int AS "upcomingReservations",
       (SELECT count(*) FROM reservations WHERE status='confirmed' AND start_time >= $1 AND start_time < $2)::int AS "todayReservations",
       (SELECT count(*) FROM reservations WHERE status='cancelled' AND cancelled_at > now() - interval '30 days')::int AS "cancelledLast30d"`,
    [todayStart, tomorrowStart],
  );
  return rows[0];
}
