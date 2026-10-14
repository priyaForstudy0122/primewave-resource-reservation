import { NextResponse } from "next/server";
import { handle, readJson } from "@/lib/api";
import { createResource, listResources } from "@/lib/services/resources";
import { resourceInputSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return handle(async () => {
    const includeInactive = new URL(request.url).searchParams.get("includeInactive") === "true";
    return NextResponse.json(await listResources({ includeInactive }));
  });
}

export function POST(request: Request) {
  return handle(async () => {
    const input = resourceInputSchema.parse(await readJson(request));
    return NextResponse.json(await createResource(input), { status: 201 });
  });
}
