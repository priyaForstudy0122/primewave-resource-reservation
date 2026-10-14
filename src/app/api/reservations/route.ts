import { NextResponse } from "next/server";
import { handle, readJson } from "@/lib/api";
import { createReservation, listReservations } from "@/lib/services/reservations";
import { reservationInputSchema } from "@/lib/validation";
import { z } from "zod";

export const dynamic = "force-dynamic";

const filterSchema = z.object({
  resourceId: z.coerce.number().int().positive().optional(),
  status: z.enum(["confirmed", "cancelled"]).optional(),
  when: z.enum(["upcoming", "past", "all"]).optional(),
  search: z.string().trim().max(100).optional(),
});

export function GET(request: Request) {
  return handle(async () => {
    const raw = Object.fromEntries(
      [...new URL(request.url).searchParams.entries()].filter(([, v]) => v !== ""),
    );
    return NextResponse.json(await listReservations(filterSchema.parse(raw)));
  });
}

export function POST(request: Request) {
  return handle(async () => {
    const input = reservationInputSchema.parse(await readJson(request));
    return NextResponse.json(await createReservation(input), { status: 201 });
  });
}
