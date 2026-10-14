import { z } from "zod";

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM (24h)");

export const resourceInputSchema = z
  .object({
    name: z.string().trim().min(2, "Name is required").max(100),
    typeId: z.coerce.number().int().positive("Pick a resource type"),
    location: z.string().trim().max(120).optional().default(""),
    description: z.string().trim().max(500).optional().default(""),
    capacity: z.coerce.number().int().min(1).max(10_000),
    openTime: hhmm,
    closeTime: hhmm,
    maxDurationMinutes: z.coerce.number().int().min(15).max(24 * 60),
    isActive: z.boolean().optional().default(true),
  })
  .refine((v) => v.closeTime > v.openTime, {
    message: "Closing time must be after opening time",
    path: ["closeTime"],
  });

export type ResourceInput = z.infer<typeof resourceInputSchema>;

export const reservationInputSchema = z
  .object({
    resourceId: z.coerce.number().int().positive("Pick a resource"),
    title: z.string().trim().min(2, "Give the reservation a title").max(150),
    notes: z.string().trim().max(500).optional().default(""),
    attendees: z.coerce.number().int().min(1).max(10_000),
    // ISO-8601 instants (UTC). The UI converts local input before sending.
    startTime: z.string().datetime({ offset: true, message: "Invalid start time" }),
    endTime: z.string().datetime({ offset: true, message: "Invalid end time" }),
    userName: z.string().trim().min(2, "Your name is required").max(100),
    userEmail: z.string().trim().toLowerCase().email("Enter a valid e-mail"),
    team: z.string().trim().max(80).optional().default(""),
  })
  .refine((v) => new Date(v.endTime) > new Date(v.startTime), {
    message: "End time must be after start time",
    path: ["endTime"],
  });

export type ReservationInput = z.infer<typeof reservationInputSchema>;

export const dateParamSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
