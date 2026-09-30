import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { getCustomerDetail } from "@/server/customers/service";
import { requirePagePermission } from "@/server/tenancy/guard";
import { CustomerForm } from "../../customer-form";

export const metadata: Metadata = { title: "Modifier le client" };

export default async function EditCustomerPage({ params }: PageProps<"/customers/[id]/edit">) {
  const ctx = await requirePagePermission("customers.manage");
  const { id } = await params;
  const detail = getCustomerDetail(ctx, id);
  if (!detail) notFound();

  return (
    <div className="max-w-3xl">
      <PageHeader title={`Modifier ${detail.name}`} back={{ href: `/customers/${id}`, label: detail.name }} />
      <CustomerForm customer={detail.customer} cancelHref={`/customers/${id}`} />
    </div>
  );
}
