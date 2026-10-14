import { NextResponse } from "next/server";
import { handle, parseId } from "@/lib/api";
import { cancelReservation, getReservation } from "@/lib/services/reservations";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export function GET(_req: Request, { params }: Ctx) {
  return handle(async () => NextResponse.json(await getReservation(parseId((await params).id))));
}

/** DELETE = cancel. The row is kept (status = cancelled) so history and usage stats stay accurate. */
export function DELETE(_req: Request, { params }: Ctx) {
  return handle(async () => NextResponse.json(await cancelReservation(parseId((await params).id))));
}
