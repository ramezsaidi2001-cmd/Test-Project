import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert, Badge, ButtonLink, Card, DescriptionList, PageHeader, Table, TBody, Td, THead } from "@/components/ui";
import { RISK_LABEL } from "@/domain/customers/risk";
import { CONTRACT_STATUS, DEPOSIT_METHOD, DEPOSIT_STATUS, fuelLabel, ID_DOCUMENT } from "@/domain/labels";
import type { PriceLine } from "@/domain/rentals/types";
import { formatDateTime } from "@/domain/shared/dates";
import { formatTnd } from "@/domain/shared/money";
import { can } from "@/domain/tenancy/permissions";
import { getContractDetail } from "@/server/rentals/service";
import { requirePagePermission } from "@/server/tenancy/guard";
import { CancelForm, CheckinForm, CheckoutForm, CloseForm } from "./panels";

export async function generateMetadata({ params }: PageProps<"/reservations/[id]">): Promise<Metadata> {
  const ctx = await requirePagePermission("contracts.view");
  const detail = getContractDetail(ctx, (await params).id);
  return { title: detail ? `Contrat ${detail.contract.number}` : "Contrat introuvable" };
}

function Lines({ lines }: { lines: PriceLine[] }) {
  return (
    <Table>
      <THead
        columns={[
          "Désignation",
          { label: "Qté", className: "text-right" },
          { label: "P.U. HT", className: "text-right" },
          { label: "Total HT", className: "text-right" },
        ]}
      />
      <TBody>
        {lines.map((l, i) => (
          <tr key={i}>
            <Td>{l.label}</Td>
            <Td className="text-right tabular-nums">{l.quantity}</Td>
            <Td className="whitespace-nowrap text-right tabular-nums">{formatTnd(l.unitPrice)}</Td>
            <Td className="whitespace-nowrap text-right tabular-nums">{formatTnd(l.total)}</Td>
          </tr>
        ))}
      </TBody>
    </Table>
  );
}

function Totals({ subtotal, tva, tvaBp, timbre, total, label = "Total TTC" }: { subtotal: number; tva: number; tvaBp: number; timbre: number; total: number; label?: string }) {
  return (
    <dl className="ml-auto mt-3 max-w-xs space-y-1 text-sm">
      <div className="flex justify-between gap-4">
        <dt className="text-muted">Sous-total HT</dt>
        <dd className="tabular-nums">{formatTnd(subtotal)}</dd>
      </div>
      <div className="flex justify-between gap-4">
        <dt className="text-muted">TVA {tvaBp / 100} %</dt>
        <dd className="tabular-nums">{formatTnd(tva)}</dd>
      </div>
      <div className="flex justify-between gap-4">
        <dt className="text-muted">Timbre fiscal</dt>
        <dd className="tabular-nums">{formatTnd(timbre)}</dd>
      </div>
      <div className="flex justify-between gap-4 border-t border-border pt-1 text-base font-semibold">
        <dt>{label}</dt>
        <dd className="tabular-nums">{formatTnd(total)}</dd>
      </div>
    </dl>
  );
}

export default async function ContractPage({ params }: PageProps<"/reservations/[id]">) {
  const ctx = await requirePagePermission("contracts.view");
  const { id } = await params;
  const d = getContractDetail(ctx, id);
  if (!d) notFound();

  const { contract, customer, vehicle, risk, invoice } = d;
  const now = new Date();
  const overdue = contract.status === "en_cours" && new Date(contract.endAt) < now;
  const canManage = can(ctx.role, "contracts.manage");
  const status = CONTRACT_STATUS[contract.status];
  const rate = contract.rate;
  const hasFinal = d.returnLines.length > 0 || contract.checkin;

  return (
    <div className="max-w-6xl space-y-6">
      <PageHeader
        back={{ href: "/reservations", label: "Réservations" }}
        title={
          <span className="flex flex-wrap items-center gap-2">
            Contrat {contract.number}
            <Badge tone={status.tone}>{status.label}</Badge>
            {overdue && <Badge tone="danger">En retard</Badge>}
          </span>
        }
        description={`Créé le ${formatDateTime(contract.createdAt)} par ${contract.createdBy}`}
        actions={
          <>
            <ButtonLink href={`/reservations/${id}/contrat`} variant="secondary">
              Voir le contrat imprimable
            </ButtonLink>
            {invoice && can(ctx.role, "finance.view") && (
              <ButtonLink href={`/billing/${invoice.id}`} variant="secondary">
                Facture {invoice.number}
              </ButtonLink>
            )}
          </>
        }
      />

      {contract.status === "annulee" && (
        <Alert tone="error">Réservation annulée{contract.cancelledReason ? ` : ${contract.cancelledReason}` : "."}</Alert>
      )}
      {overdue && <Alert tone="error">Le véhicule aurait dû être restitué le {formatDateTime(contract.endAt)}.</Alert>}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card
          title="Client"
          actions={<Badge tone={RISK_LABEL[risk.level].tone}>{RISK_LABEL[risk.level].label}</Badge>}
        >
          <DescriptionList
            items={[
              {
                label: "Nom",
                value: can(ctx.role, "customers.view") ? (
                  <Link href={`/customers/${customer.id}`} className="font-medium text-primary hover:underline">
                    {d.customerName}
                  </Link>
                ) : (
                  d.customerName
                ),
              },
              { label: ID_DOCUMENT[customer.idType], value: customer.idNumber },
              { label: "Téléphone", value: customer.phone },
              { label: "Permis", value: customer.licenseNumber },
              { label: "Conducteur additionnel", value: contract.additionalDriver ?? "—" },
            ]}
          />
          {risk.flags.length > 0 && (
            <ul className="mt-3 list-disc space-y-0.5 pl-5 text-sm text-warning">
              {risk.flags.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Véhicule">
          <DescriptionList
            items={[
              {
                label: "Immatriculation",
                value: can(ctx.role, "fleet.view") ? (
                  <Link href={`/fleet/${vehicle.id}`} className="font-medium text-primary hover:underline">
                    {vehicle.plate}
                  </Link>
                ) : (
                  vehicle.plate
                ),
              },
              { label: "Modèle", value: `${vehicle.make} ${vehicle.model} ${vehicle.trim}`.trim() },
              { label: "Catégorie", value: `${d.category.code} · ${d.category.name}` },
              { label: "Couleur", value: vehicle.color },
            ]}
          />
        </Card>

        <Card title="Période et agences">
          <DescriptionList
            items={[
              { label: "Départ prévu", value: formatDateTime(contract.startAt) },
              { label: "Retour prévu", value: formatDateTime(contract.endAt) },
              { label: "Agence de départ", value: d.pickupBranch.name },
              { label: "Agence de retour", value: d.returnBranch.name },
              { label: "Durée facturée", value: `${rate.days} jour${rate.days > 1 ? "s" : ""}` },
              {
                label: "Kilométrage inclus",
                value: rate.kmPerDay === null ? "Illimité" : `${(rate.kmPerDay * rate.days).toLocaleString("fr-FR")} km`,
              },
            ]}
          />
          {contract.notes && <p className="mt-3 whitespace-pre-line text-sm text-muted">{contract.notes}</p>}
        </Card>

        <Card title="Options et caution">
          {d.extras.length === 0 ? (
            <p className="text-sm text-muted">Aucune option.</p>
          ) : (
            <ul className="mb-4 space-y-1 text-sm">
              {d.extras.map((x) => (
                <li key={x.extraId}>
                  {x.extra?.name ?? x.extraId}
                  {x.quantity > 1 && ` × ${x.quantity}`}
                </li>
              ))}
            </ul>
          )}
          <DescriptionList
            items={[
              { label: "Montant de la caution", value: formatTnd(rate.deposit) },
              { label: "Mode", value: DEPOSIT_METHOD[contract.depositMethod] },
              { label: "Statut", value: DEPOSIT_STATUS[contract.depositStatus] },
            ]}
          />
        </Card>
      </div>

      <Card title="Tarification figée à la réservation">
        <Lines lines={rate.lines} />
        <Totals subtotal={rate.subtotal} tva={rate.tva} tvaBp={rate.tvaBp} timbre={rate.timbre} total={rate.total} />
      </Card>

      {(contract.checkout || contract.checkin) && (
        <div className="grid gap-6 lg:grid-cols-2">
          {contract.checkout && (
            <Card title="État des lieux — départ">
              <DescriptionList
                items={[
                  { label: "Date", value: formatDateTime(contract.checkout.at) },
                  { label: "Kilométrage", value: `${contract.checkout.km.toLocaleString("fr-FR")} km` },
                  { label: "Carburant", value: fuelLabel(contract.checkout.fuelLevel) },
                  { label: "Enregistré par", value: contract.checkout.recordedBy },
                ]}
              />
              {contract.checkout.notes && <p className="mt-3 whitespace-pre-line text-sm">{contract.checkout.notes}</p>}
              {contract.signature && (
                <div className="mt-4 border-t border-border pt-3">
                  <p className="text-xs text-muted">Signature du client</p>
                  {contract.signature.image && (
                    // eslint-disable-next-line @next/next/no-img-element -- data URL signature
                    <img src={contract.signature.image} alt={`Signature de ${contract.signature.name}`} className="mt-1 h-24 rounded border border-border bg-white" />
                  )}
                  <p className="mt-1 text-sm">
                    {contract.signature.name} · {formatDateTime(contract.signature.at)}
                  </p>
                </div>
              )}
            </Card>
          )}
          {contract.checkin && (
            <Card title="État des lieux — retour">
              <DescriptionList
                items={[
                  { label: "Date", value: formatDateTime(contract.checkin.at) },
                  {
                    label: "Kilométrage",
                    value: `${contract.checkin.km.toLocaleString("fr-FR")} km${
                      contract.checkout ? ` (+${(contract.checkin.km - contract.checkout.km).toLocaleString("fr-FR")} km)` : ""
                    }`,
                  },
                  { label: "Carburant", value: fuelLabel(contract.checkin.fuelLevel) },
                  { label: "Enregistré par", value: contract.checkin.recordedBy },
                ]}
              />
              {contract.checkin.notes && <p className="mt-3 whitespace-pre-line text-sm">{contract.checkin.notes}</p>}
              <div className="mt-4 border-t border-border pt-3">
                <p className="text-xs text-muted">Dommages</p>
                {contract.checkin.damages.length === 0 ? (
                  <p className="text-sm">Aucun dommage constaté.</p>
                ) : (
                  <ul className="mt-1 space-y-1 text-sm">
                    {contract.checkin.damages.map((dmg, i) => (
                      <li key={i} className="flex justify-between gap-3">
                        <span>{dmg.description}</span>
                        <span className="tabular-nums">{formatTnd(dmg.cost)} HT</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Card>
          )}
        </div>
      )}

      {hasFinal && (
        <Card title={contract.status === "cloturee" ? "Montant final facturé" : "Frais de retour et total final"}>
          {d.returnLines.length === 0 ? (
            <p className="mb-2 text-sm text-muted">Aucun frais supplémentaire (kilométrage, retard, carburant, dommages).</p>
          ) : (
            <Lines lines={d.returnLines} />
          )}
          <Totals {...d.finalTotals} tvaBp={rate.tvaBp} timbre={rate.timbre} label="Total final TTC" />
        </Card>
      )}

      {canManage && contract.status === "reservee" && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <Card title="Enregistrer le départ">
            <CheckoutForm contractId={id} defaultKm={vehicle.mileage} defaultName={d.customerName} />
          </Card>
          <Card title="Annuler la réservation">
            <CancelForm contractId={id} />
          </Card>
        </div>
      )}

      {canManage && contract.status === "en_cours" && contract.checkout && (
        <Card title="Enregistrer le retour">
          <p className="mb-4 text-sm">
            Retour prévu le <strong>{formatDateTime(contract.endAt)}</strong> à {d.returnBranch.name}.{" "}
            {overdue ? <Badge tone="danger">En retard</Badge> : <Badge tone="success">Dans les temps</Badge>}
          </p>
          <CheckinForm
            contractId={id}
            defaultKm={contract.checkout.km}
            defaultBranchId={contract.returnBranchId}
            branches={d.branches.map((b) => ({ value: b.id, label: b.name }))}
          />
        </Card>
      )}

      {canManage && contract.status === "retournee" && (
        <Card title="Clôturer et facturer">
          <CloseForm contractId={id}>
            <p className="text-sm">
              Une facture de <strong>{formatTnd(d.finalTotals.total)} TTC</strong> sera émise (dont {formatTnd(d.finalTotals.total - rate.total)}{" "}
              de frais de retour). Caution : {formatTnd(rate.deposit)} ({DEPOSIT_METHOD[contract.depositMethod]}).
            </p>
          </CloseForm>
        </Card>
      )}

      {contract.status === "cloturee" && invoice && (
        <Alert tone="success">
          Contrat clôturé — facture {invoice.number}
          {can(ctx.role, "finance.view") && (
            <>
              {" · "}
              <Link href={`/billing/${invoice.id}`} className="font-medium underline">
                Voir la facture
              </Link>
            </>
          )}
        </Alert>
      )}
    </div>
  );
}
