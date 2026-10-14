import { NextResponse } from "next/server";
import { handle, parseId } from "@/lib/api";
import { getDayAvailability } from "@/lib/services/reservations";
import { localDateString } from "@/lib/time";
import { dateParamSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const id = parseId((await params).id);
    const raw = new URL(request.url).searchParams.get("date") ?? localDateString(new Date());
    const date = dateParamSchema.parse(raw);
    return NextResponse.json(await getDayAvailability(id, date));
  });
}
