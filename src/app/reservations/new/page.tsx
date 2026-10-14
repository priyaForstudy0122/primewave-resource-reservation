import Link from "next/link";
import ReservationForm from "@/components/ReservationForm";
import { listResources } from "@/lib/services/resources";
import { dateParamSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export default async function NewReservationPage({
  searchParams,
}: {
  searchParams: Promise<{ resourceId?: string; date?: string }>;
}) {
  const sp = await searchParams;
  const resources = await listResources();
  const defaultResourceId = Number(sp.resourceId) || undefined;
  const date = dateParamSchema.safeParse(sp.date);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>New reservation</h1>
          <p className="muted">Pick a resource and a time. Overlapping bookings are rejected automatically.</p>
        </div>
      </div>
      {resources.length === 0 ? (
        <div className="card empty">
          No bookable resources yet. <Link href="/resources/new">Add one first.</Link>
        </div>
      ) : (
        <ReservationForm
          resources={resources}
          defaultResourceId={defaultResourceId}
          defaultDate={date.success ? date.data : undefined}
        />
      )}
    </>
  );
}
