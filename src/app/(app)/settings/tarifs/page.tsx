import type { Metadata } from "next";
import Link from "next/link";
import { ConfirmSubmit } from "@/components/client";
import { Badge, ButtonLink, Card, EmptyState, PageHeader, Table, TBody, Td, THead } from "@/components/ui";
import { formatDate } from "@/domain/shared/dates";
import { formatTnd, formatTndPlain } from "@/domain/shared/money";
import { getSettingsOverview } from "@/server/settings/service";
import { requirePagePermission } from "@/server/tenancy/guard";
import { createSeasonAction, deleteSeasonAction, saveCategoryAction, saveExtraAction, toggleExtraAction } from "../actions";
import { EntityForm, type FieldSpec } from "../entity-form";
import { SettingsTabs } from "../settings-tabs";

export const metadata: Metadata = { title: "Tarifs & saisons" };

const NEW = "nouvelle";
const pct = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2, signDisplay: "always" });
const linkCls = "text-sm font-medium text-primary hover:underline";

export default async function TarifsPage({ searchParams }: PageProps<"/settings/tarifs">) {
  const ctx = await requirePagePermission("tenant.manage");
  const sp = await searchParams;
  const editCategory = typeof sp.categorie === "string" ? sp.categorie : null;
  const editExtra = typeof sp.option === "string" ? sp.option : null;
  const { categories, seasons, extras, vehicleCountByCategory } = getSettingsOverview(ctx);

  const category = editCategory && editCategory !== NEW ? categories.find((c) => c.id === editCategory) : undefined;
  const showCategoryForm = editCategory === NEW || !!category;
  const extra = editExtra && editExtra !== NEW ? extras.find((e) => e.id === editExtra) : undefined;
  const showExtraForm = editExtra === NEW || !!extra;

  const categoryFields: FieldSpec[] = [
    { name: "code", label: "Code", defaultValue: category?.code, required: true, placeholder: "ECO", hint: "Ex. ECO, CMP, SUV." },
    { name: "name", label: "Nom", defaultValue: category?.name, required: true, placeholder: "Économique" },
    { kind: "decimal", name: "dailyRate", label: "Tarif journalier HT (DT)", defaultValue: category ? formatTndPlain(category.dailyRate) : "", required: true, hint: "1 à 6 jours." },
    {
      kind: "decimal",
      name: "weeklyDailyRate",
      label: "Tarif journalier 7 j+ HT (DT)",
      defaultValue: category ? formatTndPlain(category.weeklyDailyRate) : "",
      required: true,
      hint: "Appliqué dès 7 jours de location.",
    },
    { kind: "decimal", name: "deposit", label: "Caution (DT)", defaultValue: category ? formatTndPlain(category.deposit) : "", required: true },
    {
      kind: "integer",
      name: "kmPerDay",
      label: "Kilomètres inclus par jour",
      defaultValue: category?.kmPerDay != null ? String(category.kmPerDay) : "",
      hint: "Laisser vide pour un kilométrage illimité.",
    },
    {
      kind: "decimal",
      name: "extraKmRate",
      label: "Km supplémentaire HT (DT)",
      defaultValue: category ? formatTndPlain(category.extraKmRate) : "",
    },
  ];

  const seasonFields: FieldSpec[] = [
    { name: "name", label: "Nom", required: true, placeholder: "Haute saison été" },
    { kind: "date", name: "startDate", label: "Du", required: true },
    { kind: "date", name: "endDate", label: "Au (inclus)", required: true },
    { kind: "decimal", name: "adjustmentBp", label: "Ajustement (%)", required: true, placeholder: "+30 ou -15", hint: "Positif = majoration." },
  ];

  const extraFields: FieldSpec[] = [
    { name: "name", label: "Nom", defaultValue: extra?.name, required: true, placeholder: "Siège bébé" },
    {
      kind: "select",
      name: "pricing",
      label: "Tarification",
      defaultValue: extra?.pricing ?? "par_jour",
      options: [
        { value: "par_jour", label: "Par jour" },
        { value: "forfait", label: "Forfait" },
      ],
    },
    { kind: "decimal", name: "price", label: "Prix HT (DT)", defaultValue: extra ? formatTndPlain(extra.price) : "", required: true },
    { kind: "checkbox", name: "active", label: "Proposée à la réservation", defaultChecked: extra?.active ?? true },
  ];

  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <PageHeader title="Paramètres" description="Grille tarifaire par catégorie, saisons et options." />
        <SettingsTabs current="tarifs" />
      </div>

      {/* Categories */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">Catégories de véhicules</h2>
            <p className="text-sm text-muted">Les contrats existants conservent leurs tarifs figés.</p>
          </div>
          {!showCategoryForm && (
            <ButtonLink href={`/settings/tarifs?categorie=${NEW}`} variant="secondary">
              Ajouter une catégorie
            </ButtonLink>
          )}
        </div>

        {showCategoryForm && (
          <Card title={category ? `Modifier la catégorie ${category.name}` : "Nouvelle catégorie"}>
            <EntityForm
              key={editCategory}
              action={saveCategoryAction.bind(null, category?.id ?? null)}
              fields={categoryFields}
              columns={4}
              submitLabel={category ? "Enregistrer" : "Ajouter la catégorie"}
              cancelHref="/settings/tarifs"
            />
          </Card>
        )}

        {categories.length === 0 ? (
          <EmptyState title="Aucune catégorie" description="Créez vos catégories pour pouvoir tarifer vos véhicules." />
        ) : (
          <Table>
            <THead
              columns={[
                "Code",
                "Catégorie",
                { label: "Véhicules", className: "text-right" },
                { label: "Jour HT", className: "text-right" },
                { label: "7 j+ HT", className: "text-right" },
                { label: "Caution", className: "text-right" },
                "Km / jour",
                { label: "Km sup.", className: "text-right" },
                { label: "Actions", className: "text-right" },
              ]}
            />
            <TBody>
              {categories.map((c) => (
                <tr key={c.id} className={c.id === category?.id ? "bg-primary/5" : undefined}>
                  <Td className="font-mono text-xs">{c.code}</Td>
                  <Td className="font-medium">{c.name}</Td>
                  <Td className="text-right tabular-nums">{vehicleCountByCategory[c.id] ?? 0}</Td>
                  <Td className="whitespace-nowrap text-right tabular-nums">{formatTnd(c.dailyRate)}</Td>
                  <Td className="whitespace-nowrap text-right tabular-nums">{formatTnd(c.weeklyDailyRate)}</Td>
                  <Td className="whitespace-nowrap text-right tabular-nums">{formatTnd(c.deposit)}</Td>
                  <Td className="whitespace-nowrap">{c.kmPerDay == null ? "Illimité" : `${c.kmPerDay} km`}</Td>
                  <Td className="whitespace-nowrap text-right tabular-nums">{formatTnd(c.extraKmRate)}</Td>
                  <Td className="text-right">
                    <Link href={`/settings/tarifs?categorie=${c.id}`} className={linkCls}>
                      Modifier
                    </Link>
                  </Td>
                </tr>
              ))}
            </TBody>
          </Table>
        )}
      </section>

      {/* Seasons */}
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Saisons</h2>
          <p className="text-sm text-muted">Majoration ou remise appliquée aux jours de location compris dans la période.</p>
        </div>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
          {seasons.length === 0 ? (
            <EmptyState title="Aucune saison" description="Les tarifs de base s'appliquent toute l'année." />
          ) : (
            <Table>
              <THead columns={["Saison", "Période", { label: "Ajustement", className: "text-right" }, { label: "Actions", className: "text-right" }]} />
              <TBody>
                {seasons.map((s) => (
                  <tr key={s.id}>
                    <Td className="font-medium">{s.name}</Td>
                    <Td className="whitespace-nowrap text-muted">
                      {formatDate(`${s.startDate}T12:00:00Z`)} → {formatDate(`${s.endDate}T12:00:00Z`)}
                    </Td>
                    <Td className="text-right">
                      <Badge tone={s.adjustmentBp > 0 ? "warning" : "success"}>{pct.format(s.adjustmentBp / 100)} %</Badge>
                    </Td>
                    <Td className="text-right">
                      <form action={deleteSeasonAction.bind(null, s.id)}>
                        <ConfirmSubmit message={`Supprimer la saison « ${s.name} » ?`} variant="ghost" className="!px-2 !py-1 text-danger">
                          Supprimer
                        </ConfirmSubmit>
                      </form>
                    </Td>
                  </tr>
                ))}
              </TBody>
            </Table>
          )}
          <Card title="Ajouter une saison">
            <EntityForm action={createSeasonAction} fields={seasonFields} submitLabel="Ajouter la saison" />
          </Card>
        </div>
      </section>

      {/* Extras */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">Options et suppléments</h2>
            <p className="text-sm text-muted">Siège bébé, GPS, conducteur additionnel, livraison…</p>
          </div>
          {!showExtraForm && (
            <ButtonLink href={`/settings/tarifs?option=${NEW}`} variant="secondary">
              Ajouter une option
            </ButtonLink>
          )}
        </div>

        {showExtraForm && (
          <Card title={extra ? `Modifier l'option ${extra.name}` : "Nouvelle option"}>
            <EntityForm
              key={editExtra}
              action={saveExtraAction.bind(null, extra?.id ?? null)}
              fields={extraFields}
              columns={4}
              submitLabel={extra ? "Enregistrer" : "Ajouter l'option"}
              cancelHref="/settings/tarifs"
            />
          </Card>
        )}

        {extras.length === 0 ? (
          <EmptyState title="Aucune option" />
        ) : (
          <Table>
            <THead columns={["Option", "Tarification", { label: "Prix HT", className: "text-right" }, "Statut", { label: "Actions", className: "text-right" }]} />
            <TBody>
              {extras.map((e) => (
                <tr key={e.id} className={e.id === extra?.id ? "bg-primary/5" : undefined}>
                  <Td className="font-medium">{e.name}</Td>
                  <Td>{e.pricing === "par_jour" ? "Par jour" : "Forfait"}</Td>
                  <Td className="whitespace-nowrap text-right tabular-nums">{formatTnd(e.price)}</Td>
                  <Td>
                    <Badge tone={e.active ? "success" : "neutral"}>{e.active ? "Active" : "Inactive"}</Badge>
                  </Td>
                  <Td className="text-right">
                    <div className="flex items-center justify-end gap-3">
                      <form action={toggleExtraAction.bind(null, e.id)}>
                        <button type="submit" className="text-sm text-muted hover:text-foreground hover:underline">
                          {e.active ? "Désactiver" : "Activer"}
                        </button>
                      </form>
                      <Link href={`/settings/tarifs?option=${e.id}`} className={linkCls}>
                        Modifier
                      </Link>
                    </div>
                  </Td>
                </tr>
              ))}
            </TBody>
          </Table>
        )}
      </section>
    </div>
  );
}
