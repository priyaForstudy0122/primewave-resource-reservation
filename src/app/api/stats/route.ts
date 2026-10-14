import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { getDashboardSummary, getResourceUsage } from "@/lib/services/reservations";

export const dynamic = "force-dynamic";

export function GET() {
  return handle(async () => {
    const [summary, usage] = await Promise.all([getDashboardSummary(), getResourceUsage()]);
    return NextResponse.json({ summary, usage });
  });
}
