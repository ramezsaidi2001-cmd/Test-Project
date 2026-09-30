import type { Metadata } from "next";
import Link from "next/link";
import { Badge, ButtonLink, Card, EmptyState, PageHeader, Table, TBody, Td, THead } from "@/components/ui";
import { getSettingsOverview } from "@/server/settings/service";
import { requirePagePermission } from "@/server/tenancy/guard";
import { saveBranchAction } from "../actions";
import { EntityForm, type FieldSpec } from "../entity-form";
import { SettingsTabs } from "../settings-tabs";

export const metadata: Metadata = { title: "Agences & points de retrait" };

const NEW = "nouvelle";
const KIND_LABELS = { agence: "Agence", aeroport: "Aéroport" } as const;

export default async function BranchesPage({ searchParams }: PageProps<"/settings/agences">) {
  const ctx = await requirePagePermission("tenant.manage");
  const { edit } = await searchParams;
  const editId = typeof edit === "string" ? edit : null;
  const { branches, vehicleCountByBranch } = getSettingsOverview(ctx);

  const branch = editId && editId !== NEW ? branches.find((b) => b.id === editId) : undefined;
  const showForm = editId === NEW || !!branch;

  const fields: FieldSpec[] = [
    { name: "name", label: "Nom", defaultValue: branch?.name, required: true, placeholder: "Tunis Centre" },
    { name: "city", label: "Ville", defaultValue: branch?.city, required: true },
    {
      kind: "select",
      name: "kind",
      label: "Type",
      defaultValue: branch?.kind ?? "agence",
      options: [
        { value: "agence", label: "Agence" },
        { value: "aeroport", label: "Aéroport" },
      ],
    },
    { kind: "tel", name: "phone", label: "Téléphone", defaultValue: branch?.phone },
    { name: "address", label: "Adresse", defaultValue: branch?.address, required: true, span: "full" },
  ];

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <PageHeader
          title="Paramètres"
          description="Agences et points de retrait / restitution des véhicules."
          actions={
            !showForm && (
              <ButtonLink href={`/settings/agences?edit=${NEW}`} variant="secondary">
                Ajouter un point de retrait
              </ButtonLink>
            )
          }
        />
        <SettingsTabs current="agences" />
      </div>

      {showForm && (
        <Card title={branch ? `Modifier ${branch.name}` : "Nouveau point de retrait"}>
          <EntityForm
            key={editId}
            action={saveBranchAction.bind(null, branch?.id ?? null)}
            fields={fields}
            submitLabel={branch ? "Enregistrer" : "Ajouter"}
            cancelHref="/settings/agences"
          />
        </Card>
      )}

      {branches.length === 0 ? (
        <EmptyState title="Aucun point de retrait" description="Ajoutez votre première agence." />
      ) : (
        <Table>
          <THead columns={["Nom", "Type", "Ville", "Adresse", "Téléphone", { label: "Véhicules", className: "text-right" }, { label: "Actions", className: "text-right" }]} />
          <TBody>
            {branches.map((b) => (
              <tr key={b.id} className={b.id === branch?.id ? "bg-primary/5" : undefined}>
                <Td className="font-medium">{b.name}</Td>
                <Td>
                  <Badge tone={b.kind === "aeroport" ? "info" : "neutral"}>{KIND_LABELS[b.kind]}</Badge>
                </Td>
                <Td>{b.city}</Td>
                <Td className="text-muted">{b.address}</Td>
                <Td className="whitespace-nowrap">{b.phone || "—"}</Td>
                <Td className="text-right tabular-nums">{vehicleCountByBranch[b.id] ?? 0}</Td>
                <Td className="text-right">
                  <Link href={`/settings/agences?edit=${b.id}`} className="text-sm font-medium text-primary hover:underline">
                    Modifier
                  </Link>
                </Td>
              </tr>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}
