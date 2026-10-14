import { notFound } from "next/navigation";
import ResourceForm from "@/components/ResourceForm";
import { AppError } from "@/lib/errors";
import { getResource, listResourceTypes } from "@/lib/services/resources";

export const dynamic = "force-dynamic";

export default async function EditResourcePage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const [resource, types] = await Promise.all([
    getResource(id).catch((e) => {
      if (e instanceof AppError && e.status === 404) return null;
      throw e;
    }),
    listResourceTypes(),
  ]);
  if (!resource) notFound();

  return (
    <>
      <div className="page-head"><div><h1>Edit {resource.name}</h1></div></div>
      <ResourceForm types={types} initial={resource} />
    </>
  );
}
