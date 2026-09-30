import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { PrintButton } from "@/components/client";
import { DEPOSIT_METHOD, fuelLabel, ID_DOCUMENT } from "@/domain/labels";
import { formatDate, formatDateTime } from "@/domain/shared/dates";
import { formatTnd } from "@/domain/shared/money";
import { getContractDetail } from "@/server/rentals/service";
import { requirePagePermission } from "@/server/tenancy/guard";

export async function generateMetadata({ params }: PageProps<"/reservations/[id]/contrat">): Promise<Metadata> {
  const ctx = await requirePagePermission("contracts.view");
  const detail = getContractDetail(ctx, (await params).id);
  return { title: detail ? `Contrat de location ${detail.contract.number}` : "Contrat introuvable" };
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="break-inside-avoid">
      <h2 className="mb-1.5 border-b border-foreground/40 pb-0.5 text-[11px] font-bold uppercase tracking-wide">{title}</h2>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex gap-2">
      <dt className="w-32 shrink-0 text-muted">{label}</dt>
      <dd className="min-w-0 font-medium">{value || "—"}</dd>
    </div>
  );
}

export default async function PrintableContractPage({ params }: PageProps<"/reservations/[id]/contrat">) {
  const ctx = await requirePagePermission("contracts.view");
  const { id } = await params;
  const d = getContractDetail(ctx, id);
  if (!d) notFound();

  const { contract, customer, vehicle, settings: s } = d;
  const rate = contract.rate;
  const terms = s.contractTerms
    .split("\n")
    .map((t) => t.trim())
    .filter(Boolean);

  return (
    <div className="mx-auto max-w-[210mm] space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link href={`/reservations/${id}`} className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
          <span aria-hidden>←</span> Retour au contrat
        </Link>
        <PrintButton />
      </div>

      <article data-print-root className="space-y-4 rounded-lg border border-border bg-white p-6 text-[12px] leading-snug text-black print:rounded-none print:border-0 print:p-0 sm:p-10">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-black pb-3">
          <div>
            <p className="text-lg font-bold">{s.tradeName}</p>
            <p>{s.legalName}</p>
            <p>
              {s.address}, {s.city}
            </p>
            <p>
              Tél. {s.phone} · {s.email}
            </p>
          </div>
          <div className="text-right">
            <p>Matricule fiscal : {s.taxId}</p>
            <p>RNE : {s.rne}</p>
          </div>
        </header>

        <div className="text-center">
          <h1 className="text-base font-bold uppercase">Contrat de location N° {contract.number}</h1>
          <p className="text-muted">Établi le {formatDate(contract.createdAt)}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 print:grid-cols-2">
          <Section title="Locataire">
            <dl className="space-y-0.5">
              <Row label="Nom" value={d.customerName} />
              {customer.kind === "entreprise" && <Row label="Matricule fiscal" value={customer.taxId} />}
              {customer.kind === "entreprise" && <Row label="Représentant" value={`${customer.firstName} ${customer.lastName}`} />}
              <Row label={ID_DOCUMENT[customer.idType]} value={customer.idNumber} />
              <Row label="Nationalité" value={customer.nationality} />
              <Row
                label="Permis n°"
                value={`${customer.licenseNumber}${customer.licenseIssueDate ? ` du ${formatDate(customer.licenseIssueDate)}` : ""}`}
              />
              <Row label="Adresse" value={`${customer.address}, ${customer.city}`} />
              <Row label="Téléphone" value={customer.phone} />
            </dl>
          </Section>

          <Section title="Véhicule">
            <dl className="space-y-0.5">
              <Row label="Marque / modèle" value={`${vehicle.make} ${vehicle.model}`} />
              <Row label="Immatriculation" value={vehicle.plate} />
              <Row label="Couleur" value={vehicle.color} />
              <Row label="Catégorie" value={rate.categoryName} />
              <Row label="Conducteur add." value={contract.additionalDriver} />
            </dl>
          </Section>

          <Section title="Période et agences">
            <dl className="space-y-0.5">
              <Row label="Départ" value={formatDateTime(contract.checkout?.at ?? contract.startAt)} />
              <Row label="Retour prévu" value={formatDateTime(contract.endAt)} />
              {contract.checkin && <Row label="Retour effectif" value={formatDateTime(contract.checkin.at)} />}
              <Row label="Agence départ" value={d.pickupBranch.name} />
              <Row label="Agence retour" value={d.returnBranch.name} />
              <Row label="Km inclus" value={rate.kmPerDay === null ? "Illimité" : `${(rate.kmPerDay * rate.days).toLocaleString("fr-FR")} km`} />
            </dl>
          </Section>

          <Section title="Kilométrage et carburant">
            <dl className="space-y-0.5">
              <Row label="Km départ" value={contract.checkout ? `${contract.checkout.km.toLocaleString("fr-FR")} km` : "……………… km"} />
              <Row label="Carburant départ" value={contract.checkout ? fuelLabel(contract.checkout.fuelLevel) : "…… / 8"} />
              <Row label="Km retour" value={contract.checkin ? `${contract.checkin.km.toLocaleString("fr-FR")} km` : "……………… km"} />
              <Row label="Carburant retour" value={contract.checkin ? fuelLabel(contract.checkin.fuelLevel) : "…… / 8"} />
            </dl>
          </Section>
        </div>

        <Section title="Tarification">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-black/40">
                <th className="py-1 font-semibold">Désignation</th>
                <th className="py-1 text-right font-semibold">Qté</th>
                <th className="py-1 text-right font-semibold">P.U. HT</th>
                <th className="py-1 text-right font-semibold">Total HT</th>
              </tr>
            </thead>
            <tbody>
              {rate.lines.map((l, i) => (
                <tr key={i} className="border-b border-black/10">
                  <td className="py-0.5">{l.label}</td>
                  <td className="py-0.5 text-right tabular-nums">{l.quantity}</td>
                  <td className="py-0.5 text-right tabular-nums">{formatTnd(l.unitPrice)}</td>
                  <td className="py-0.5 text-right tabular-nums">{formatTnd(l.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <dl className="ml-auto mt-2 w-64 space-y-0.5">
            <div className="flex justify-between">
              <dt>Sous-total HT</dt>
              <dd className="tabular-nums">{formatTnd(rate.subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>TVA {rate.tvaBp / 100} %</dt>
              <dd className="tabular-nums">{formatTnd(rate.tva)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Timbre fiscal</dt>
              <dd className="tabular-nums">{formatTnd(rate.timbre)}</dd>
            </div>
            <div className="flex justify-between border-t border-black pt-0.5 font-bold">
              <dt>Total TTC</dt>
              <dd className="tabular-nums">{formatTnd(rate.total)}</dd>
            </div>
          </dl>
          <p className="mt-2">
            Caution : <strong>{formatTnd(rate.deposit)}</strong> ({DEPOSIT_METHOD[contract.depositMethod]}). Kilomètre supplémentaire :{" "}
            {formatTnd(rate.extraKmRate)} HT.
          </p>
        </Section>

        <Section title="Conditions générales de location">
          <ol className="list-decimal space-y-0.5 pl-4 text-[10.5px]">
            {terms.map((t, i) => (
              <li key={i}>{t.replace(/^\d+[.)]\s*/, "")}</li>
            ))}
          </ol>
        </Section>

        <div className="grid grid-cols-2 gap-6 pt-2">
          <div className="break-inside-avoid">
            <p className="font-semibold">Pour l&apos;agence</p>
            <p className="text-muted">Cachet et signature</p>
            <div className="mt-1 h-24 rounded border border-black/40" />
          </div>
          <div className="break-inside-avoid">
            <p className="font-semibold">Le locataire</p>
            <p className="text-muted">« Lu et approuvé »</p>
            <div className="mt-1 flex h-24 items-center justify-center rounded border border-black/40">
              {contract.signature?.image && (
                // eslint-disable-next-line @next/next/no-img-element -- data URL signature
                <img src={contract.signature.image} alt={`Signature de ${contract.signature.name}`} className="max-h-full" />
              )}
            </div>
            {contract.signature && (
              <p className="mt-1 text-[10.5px]">
                Signé par {contract.signature.name} le {formatDateTime(contract.signature.at)}
              </p>
            )}
          </div>
        </div>
      </article>
    </div>
  );
}
