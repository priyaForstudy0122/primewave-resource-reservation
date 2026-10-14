// Proves the double-booking guarantee: fires many simultaneous requests for the
// SAME resource and time slot. Exactly ONE must succeed, the rest must be 409.
//
// Usage (app must be running):  npm run test:concurrency
//   BASE_URL=http://localhost:3000 CLIENTS=20 npm run test:concurrency
const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const CLIENTS = Number(process.env.CLIENTS ?? 15);
const OFFSET_MIN = Number(process.env.APP_UTC_OFFSET_MINUTES ?? 330);

const resources = await (await fetch(`${BASE_URL}/api/resources`)).json();
const resource = resources[0];
if (!resource) throw new Error("No resources found. Run `npm run db:setup` first.");

// A slot 40 days from now, one hour after the resource opens (always in the future).
const [oh, om] = resource.open_time.split(":").map(Number);
const local = new Date(Date.now() + OFFSET_MIN * 60_000);
const dayMs = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + 40);
const start = new Date(dayMs - OFFSET_MIN * 60_000 + (oh * 60 + om + 60) * 60_000);
const end = new Date(start.getTime() + 60 * 60_000);

console.log(`Resource : ${resource.name}`);
console.log(`Slot     : ${start.toISOString()} → ${end.toISOString()}`);
console.log(`Sending ${CLIENTS} simultaneous booking requests...\n`);

const results = await Promise.all(
  Array.from({ length: CLIENTS }, async (_, i) => {
    const res = await fetch(`${BASE_URL}/api/reservations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resourceId: resource.id,
        title: `Race test #${i + 1}`,
        attendees: 1,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        userName: `Tester ${i + 1}`,
        userEmail: `tester${i + 1}@example.com`,
      }),
    });
    return { i: i + 1, status: res.status, body: await res.json() };
  }),
);

const winners = results.filter((r) => r.status === 201);
const rejected = results.filter((r) => r.status === 409);
const other = results.filter((r) => r.status !== 201 && r.status !== 409);

console.log(`201 Created : ${winners.length}`);
console.log(`409 Conflict: ${rejected.length}`);
if (other.length) console.log(`Unexpected  : ${other.map((o) => `#${o.i}=${o.status}`).join(", ")}`);

// Clean up so the test can be re-run.
for (const w of winners) await fetch(`${BASE_URL}/api/reservations/${w.body.id}`, { method: "DELETE" });

if (winners.length === 1 && rejected.length === CLIENTS - 1) {
  console.log("\n✅ PASS: exactly one booking won, no double-booking possible.");
} else {
  console.error("\n❌ FAIL: the overlap guarantee was violated.");
  process.exit(1);
}
