import type { Metadata } from "next";
import { Card, PageHeader } from "@/components/ui";
import { formatTndPlain } from "@/domain/shared/money";
import { getSettingsOverview } from "@/server/settings/service";
import { requirePagePermission } from "@/server/tenancy/guard";
import { updateAgencyAction } from "./actions";
import { EntityForm, type FieldSpec } from "./entity-form";
import { SettingsTabs } from "./settings-tabs";

export const metadata: Metadata = { title: "Paramètres" };

const plainNumber = (n: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2, useGrouping: false }).format(n);

export default async function SettingsPage() {
  const ctx = await requirePagePermission("tenant.manage");
  const { settings: s } = getSettingsOverview(ctx);

  const fields: FieldSpec[] = [
    { kind: "section", title: "Informations de l'agence", description: "Affichées sur les contrats et les factures." },
    { name: "tradeName", label: "Nom commercial", defaultValue: s.tradeName, required: true },
    { name: "legalName", label: "Raison sociale", defaultValue: s.legalName, required: true },
    { name: "taxId", label: "Matricule fiscal", defaultValue: s.taxId, required: true, placeholder: "1234567/A/M/000" },
    { name: "rne", label: "Identifiant RNE", defaultValue: s.rne },
    { name: "address", label: "Adresse", defaultValue: s.address, required: true },
    { name: "city", label: "Ville", defaultValue: s.city, required: true },
    { kind: "tel", name: "phone", label: "Téléphone", defaultValue: s.phone, required: true },
    { kind: "email", name: "email", label: "E-mail", defaultValue: s.email },

    { kind: "section", title: "Fiscalité et facturation" },
    { kind: "decimal", name: "tvaBp", label: "Taux de TVA (%)", defaultValue: plainNumber((s.tvaBp ?? 1900) / 100), hint: "19 % par défaut." },
    { kind: "decimal", name: "timbre", label: "Timbre fiscal (DT)", defaultValue: formatTndPlain(s.timbre ?? 1000), hint: "Ajouté à chaque facture (1,000 DT)." },
    { kind: "integer", name: "paymentTermDays", label: "Délai de paiement (jours)", defaultValue: String(s.paymentTermDays), hint: "Échéance des factures." },
    {
      kind: "textarea",
      name: "invoiceFooter",
      label: "Pied de facture",
      defaultValue: s.invoiceFooter,
      span: "full",
      rows: 2,
      placeholder: "Coordonnées bancaires (RIB), mentions légales…",
    },

    { kind: "section", title: "Règles de location" },
    {
      kind: "decimal",
      name: "fuelChargePerEighth",
      label: "Carburant manquant (DT HT par 1/8 de réservoir)",
      defaultValue: formatTndPlain(s.fuelChargePerEighth),
    },
    {
      kind: "integer",
      name: "lateGraceMinutes",
      label: "Tolérance de retard (minutes)",
      defaultValue: String(s.lateGraceMinutes),
      hint: "Au-delà, une journée supplémentaire est facturée.",
    },

    { kind: "section", title: "Conditions générales du contrat", description: "Une clause par ligne ; imprimées au verso du contrat de location." },
    { kind: "textarea", name: "contractTerms", label: "Clauses", defaultValue: s.contractTerms, rows: 10, span: "full" },
  ];

  return (
    <div className="max-w-5xl">
      <PageHeader title="Paramètres" description="Identité de l'agence, fiscalité et règles de location." />
      <SettingsTabs current="agence" />
      <Card>
        <EntityForm action={updateAgencyAction} fields={fields} submitLabel="Enregistrer les paramètres" />
      </Card>
    </div>
  );
}
