import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError } from "./errors";

/** Wraps a route handler so every failure becomes a consistent JSON error. */
export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof ZodError) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of err.issues) fieldErrors[issue.path.join(".") || "_"] = issue.message;
      return NextResponse.json(
        { error: err.issues[0]?.message ?? "Invalid input", fieldErrors },
        { status: 400 },
      );
    }
    if (err instanceof AppError) {
      return NextResponse.json({ error: err.message, details: err.details }, { status: err.status });
    }
    console.error("Unhandled API error:", err);
    return NextResponse.json({ error: "Something went wrong on our side. Please try again." }, { status: 500 });
  }
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new AppError(400, "Request body must be valid JSON");
  }
}

export function parseId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw new AppError(400, "Invalid id");
  return id;
}
