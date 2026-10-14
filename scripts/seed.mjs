// Seeds realistic demo data. Safe to run more than once (it skips if data exists).
// Reservation times are relative to "today" so the demo always looks alive.
import pg from "pg";
import { loadEnv } from "./env.mjs";

loadEnv();
const OFFSET_MIN = Number(process.env.APP_UTC_OFFSET_MINUTES ?? 330);

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

// Start of "today" in the organisation's local time, as a UTC Date.
function localDayStart(daysFromToday) {
  const local = new Date(Date.now() + OFFSET_MIN * 60_000);
  const startLocalMs = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + daysFromToday);
  return new Date(startLocalMs - OFFSET_MIN * 60_000);
}
const at = (day, hour, minute = 0) => new Date(localDayStart(day).getTime() + (hour * 60 + minute) * 60_000);

try {
  const { rows } = await client.query("SELECT count(*)::int AS n FROM resources");
  if (rows[0].n > 0) {
    console.log("Seed skipped: resources already exist.");
    process.exit(0);
  }
  await client.query("BEGIN");

  await client.query(`
    INSERT INTO resource_types (name, description) VALUES
      ('Meeting Room', 'Rooms for meetings, interviews and workshops'),
      ('Vehicle',      'Company vehicles for official travel'),
      ('Equipment',    'Shared equipment such as projectors and cameras'),
      ('Lab',          'Specialised work areas'),
      ('Sports',       'Recreational facilities')`);

  await client.query(`
    INSERT INTO resources (type_id, name, location, description, capacity, open_time, close_time, max_duration_minutes) VALUES
      ((SELECT id FROM resource_types WHERE name='Meeting Room'), 'Boardroom Alpha',   'Floor 3',        'Large boardroom with video conferencing', 14, '08:00', '18:00', 240),
      ((SELECT id FROM resource_types WHERE name='Meeting Room'), 'Huddle Room Beta',  'Floor 2',        'Small room for quick syncs',               4, '08:00', '18:00', 120),
      ((SELECT id FROM resource_types WHERE name='Meeting Room'), 'Training Hall',     'Ground Floor',   'Workshop space with movable seating',     40, '08:00', '20:00', 480),
      ((SELECT id FROM resource_types WHERE name='Vehicle'),      'Company Van (KB-4521)', 'Basement Parking', '9-seater van for site visits',          9, '06:00', '22:00', 720),
      ((SELECT id FROM resource_types WHERE name='Equipment'),    'Portable Projector', 'IT Store',     'HD projector with HDMI and screen',         1, '08:00', '18:00', 480),
      ((SELECT id FROM resource_types WHERE name='Lab'),          'Device Test Lab',   'Floor 1',        'Lab with test devices and benches',        10, '09:00', '17:00', 240),
      ((SELECT id FROM resource_types WHERE name='Sports'),       'Badminton Court',   'Recreation Block','Indoor court, 4 players',                   4, '16:00', '21:00', 120)`);

  const users = [
    ["Nimal Perera", "nimal.perera@example.com", "Engineering"],
    ["Ayesha Fernando", "ayesha.fernando@example.com", "Design"],
    ["Kasun Silva", "kasun.silva@example.com", "Operations"],
    ["Tharushi Jayasinghe", "tharushi.j@example.com", "HR"],
  ];
  for (const [name, email, team] of users) {
    await client.query("INSERT INTO users (name, email, team) VALUES ($1,$2,$3)", [name, email, team]);
  }

  const rid = async (name) => (await client.query("SELECT id FROM resources WHERE name=$1", [name])).rows[0].id;
  const uid = async (email) => (await client.query("SELECT id FROM users WHERE email=$1", [email])).rows[0].id;

  const reservations = [
    // [resource, user, title, attendees, start, end, status]
    ["Boardroom Alpha", "nimal.perera@example.com", "Sprint planning", 8, at(0, 9), at(0, 10, 30), "confirmed"],
    ["Boardroom Alpha", "ayesha.fernando@example.com", "Design review", 6, at(0, 11), at(0, 12), "confirmed"],
    ["Boardroom Alpha", "kasun.silva@example.com", "Vendor call", 5, at(0, 14), at(0, 15, 30), "confirmed"],
    ["Huddle Room Beta", "tharushi.j@example.com", "1:1 interviews", 3, at(0, 10), at(0, 12), "confirmed"],
    ["Training Hall", "tharushi.j@example.com", "New joiner orientation", 25, at(1, 9), at(1, 13), "confirmed"],
    ["Company Van (KB-4521)", "kasun.silva@example.com", "Client site visit - Galle", 6, at(1, 7), at(1, 17), "confirmed"],
    ["Portable Projector", "ayesha.fernando@example.com", "Client demo", 1, at(0, 13), at(0, 16), "confirmed"],
    ["Device Test Lab", "nimal.perera@example.com", "Mobile regression testing", 4, at(2, 9), at(2, 12), "confirmed"],
    ["Badminton Court", "kasun.silva@example.com", "Team social", 4, at(0, 17), at(0, 18), "confirmed"],
    // some history so the usage dashboard has data
    ["Boardroom Alpha", "nimal.perera@example.com", "Quarterly review", 10, at(-3, 9), at(-3, 12), "confirmed"],
    ["Boardroom Alpha", "ayesha.fernando@example.com", "Brand workshop", 9, at(-6, 13), at(-6, 17), "confirmed"],
    ["Huddle Room Beta", "kasun.silva@example.com", "Ops sync", 3, at(-2, 8), at(-2, 9), "confirmed"],
    ["Training Hall", "tharushi.j@example.com", "Safety training", 30, at(-9, 9), at(-9, 16), "confirmed"],
    ["Company Van (KB-4521)", "kasun.silva@example.com", "Airport pickup", 4, at(-4, 8), at(-4, 12), "confirmed"],
    ["Device Test Lab", "nimal.perera@example.com", "Device calibration", 2, at(-5, 10), at(-5, 13), "confirmed"],
    ["Portable Projector", "tharushi.j@example.com", "Town hall", 1, at(-7, 9), at(-7, 11), "confirmed"],
    ["Boardroom Alpha", "kasun.silva@example.com", "Cancelled offsite prep", 5, at(1, 10), at(1, 11), "cancelled"],
  ];

  for (const [res, email, title, attendees, start, end, status] of reservations) {
    const { rows: r } = await client.query(
      `INSERT INTO reservations (resource_id, user_id, title, attendees, start_time, end_time, status, cancelled_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7, CASE WHEN $7 = 'cancelled' THEN now() ELSE NULL END)
       RETURNING id`,
      [await rid(res), await uid(email), title, attendees, start, end, status],
    );
    await client.query("INSERT INTO reservation_events (reservation_id, event_type) VALUES ($1,'created')", [r[0].id]);
    if (status === "cancelled") {
      await client.query(
        "INSERT INTO reservation_events (reservation_id, event_type, detail) VALUES ($1,'cancelled','Seeded example')",
        [r[0].id],
      );
    }
  }

  await client.query("COMMIT");
  console.log("Seeded demo data.");
} catch (err) {
  await client.query("ROLLBACK");
  throw err;
} finally {
  await client.end();
}
