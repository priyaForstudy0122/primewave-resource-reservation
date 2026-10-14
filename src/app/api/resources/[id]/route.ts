import { NextResponse } from "next/server";
import { handle, parseId, readJson } from "@/lib/api";
import { getResource, setResourceActive, updateResource } from "@/lib/services/resources";
import { resourceInputSchema } from "@/lib/validation";
import { z } from "zod";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export function GET(_req: Request, { params }: Ctx) {
  return handle(async () => NextResponse.json(await getResource(parseId((await params).id))));
}

export function PUT(request: Request, { params }: Ctx) {
  return handle(async () => {
    const id = parseId((await params).id);
    const input = resourceInputSchema.parse(await readJson(request));
    return NextResponse.json(await updateResource(id, input));
  });
}

/** PATCH { isActive: boolean } enables / disables a resource without deleting history. */
export function PATCH(request: Request, { params }: Ctx) {
  return handle(async () => {
    const id = parseId((await params).id);
    const { isActive } = z.object({ isActive: z.boolean() }).parse(await readJson(request));
    return NextResponse.json(await setResourceActive(id, isActive));
  });
}
