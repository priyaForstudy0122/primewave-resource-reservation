import ResourceForm from "@/components/ResourceForm";
import { listResourceTypes } from "@/lib/services/resources";

export const dynamic = "force-dynamic";

export default async function NewResourcePage() {
  const types = await listResourceTypes();
  return (
    <>
      <div className="page-head"><div><h1>Add resource</h1><p className="muted">Define what can be reserved and when it is available.</p></div></div>
      <ResourceForm types={types} />
    </>
  );
}
