import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { requirePagePermission } from "@/server/tenancy/guard";
import { CustomerForm } from "../customer-form";

export const metadata: Metadata = { title: "Nouveau client" };

export default async function NewCustomerPage() {
  await requirePagePermission("customers.manage");

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Nouveau client"
        description="Les informations d'identité et de permis figurent sur le contrat de location."
        back={{ href: "/customers", label: "Clients" }}
      />
      <CustomerForm cancelHref="/customers" />
    </div>
  );
}
