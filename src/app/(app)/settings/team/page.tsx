import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { can } from "@/domain/tenancy/permissions";
import { ROLE_LABELS } from "@/domain/tenancy/roles";
import { getTenantContext } from "@/server/tenancy/context";
import { listTeamMembers } from "@/server/tenancy/members";
import { SettingsTabs } from "../settings-tabs";

export const metadata: Metadata = { title: "Équipe" };

export default async function TeamPage() {
  const ctx = await getTenantContext();
  if (!can(ctx.role, "members.view")) redirect("/dashboard");

  const members = await listTeamMembers(ctx.tenant.id);
  const dateFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" });
  const showTabs = can(ctx.role, "tenant.manage");

  return (
    <div className="max-w-4xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{showTabs ? "Paramètres" : "Équipe"}</h1>
        <p className="mt-1 text-sm text-muted">
          {members.length} {members.length === 1 ? "membre" : "membres"} chez {ctx.tenant.name}.
          {can(ctx.role, "members.manage") && " Les invitations et la gestion des rôles arrivent bientôt."}
        </p>
      </header>
      {showTabs && <SettingsTabs current="equipe" />}

      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-xs uppercase tracking-wide text-muted">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">Nom</th>
              <th scope="col" className="px-4 py-3 font-medium">E-mail</th>
              <th scope="col" className="px-4 py-3 font-medium">Rôle</th>
              <th scope="col" className="px-4 py-3 font-medium">Membre depuis</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {members.map((m) => (
              <tr key={m.userId}>
                <td className="px-4 py-3 font-medium">
                  {m.fullName ?? "—"}
                  {m.userId === ctx.user.id && <span className="ml-2 text-xs text-muted">(vous)</span>}
                </td>
                <td className="px-4 py-3 text-muted">{m.email ?? "—"}</td>
                <td className="px-4 py-3">{ROLE_LABELS[m.role]}</td>
                <td className="px-4 py-3 text-muted">{dateFormat.format(new Date(m.joinedAt))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
