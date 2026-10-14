import { query } from "../db";
import { conflict, notFound } from "../errors";
import type { ResourceInput } from "../validation";

export interface ResourceRow {
  id: number;
  type_id: number;
  type_name: string;
  name: string;
  location: string | null;
  description: string | null;
  capacity: number;
  open_time: string; // "08:00:00"
  close_time: string;
  max_duration_minutes: number;
  is_active: boolean;
}

export interface ResourceTypeRow {
  id: number;
  name: string;
}

const SELECT_RESOURCE = `
  SELECT r.id, r.type_id, t.name AS type_name, r.name, r.location, r.description,
         r.capacity, to_char(r.open_time, 'HH24:MI') AS open_time,
         to_char(r.close_time, 'HH24:MI') AS close_time,
         r.max_duration_minutes, r.is_active
  FROM resources r
  JOIN resource_types t ON t.id = r.type_id`;

export async function listResourceTypes(): Promise<ResourceTypeRow[]> {
  return query<ResourceTypeRow>("SELECT id, name FROM resource_types ORDER BY name");
}

export async function listResources(opts: { includeInactive?: boolean } = {}): Promise<ResourceRow[]> {
  const where = opts.includeInactive ? "" : "WHERE r.is_active";
  return query<ResourceRow>(`${SELECT_RESOURCE} ${where} ORDER BY t.name, r.name`);
}

export async function getResource(id: number): Promise<ResourceRow> {
  const rows = await query<ResourceRow>(`${SELECT_RESOURCE} WHERE r.id = $1`, [id]);
  if (!rows[0]) throw notFound("Resource");
  return rows[0];
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "23505";
}

function isForeignKeyViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "23503";
}

export async function createResource(input: ResourceInput): Promise<ResourceRow> {
  try {
    const rows = await query<{ id: number }>(
      `INSERT INTO resources (type_id, name, location, description, capacity, open_time, close_time, max_duration_minutes, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [
        input.typeId,
        input.name,
        input.location || null,
        input.description || null,
        input.capacity,
        input.openTime,
        input.closeTime,
        input.maxDurationMinutes,
        input.isActive,
      ],
    );
    return getResource(rows[0].id);
  } catch (err) {
    if (isUniqueViolation(err)) throw conflict(`A resource named "${input.name}" already exists`);
    if (isForeignKeyViolation(err)) throw conflict("Unknown resource type");
    throw err;
  }
}

export async function updateResource(id: number, input: ResourceInput): Promise<ResourceRow> {
  try {
    const rows = await query<{ id: number }>(
      `UPDATE resources
       SET type_id=$2, name=$3, location=$4, description=$5, capacity=$6,
           open_time=$7, close_time=$8, max_duration_minutes=$9, is_active=$10, updated_at=now()
       WHERE id=$1 RETURNING id`,
      [
        id,
        input.typeId,
        input.name,
        input.location || null,
        input.description || null,
        input.capacity,
        input.openTime,
        input.closeTime,
        input.maxDurationMinutes,
        input.isActive,
      ],
    );
    if (!rows[0]) throw notFound("Resource");
    return getResource(id);
  } catch (err) {
    if (isUniqueViolation(err)) throw conflict(`A resource named "${input.name}" already exists`);
    if (isForeignKeyViolation(err)) throw conflict("Unknown resource type");
    throw err;
  }
}

/** Soft-disable: history is kept, but the resource can no longer be booked. */
export async function setResourceActive(id: number, isActive: boolean): Promise<ResourceRow> {
  const rows = await query<{ id: number }>(
    "UPDATE resources SET is_active=$2, updated_at=now() WHERE id=$1 RETURNING id",
    [id, isActive],
  );
  if (!rows[0]) throw notFound("Resource");
  return getResource(id);
}
