"use client";

import type { Membership } from "@/server/tenancy/context";
import { switchTenant } from "./actions";

export function TenantSwitcher({ memberships, activeId }: { memberships: Membership[]; activeId: string }) {
  return (
    <form action={switchTenant}>
      <label htmlFor="tenantId" className="sr-only">
        Agence
      </label>
      <select
        id="tenantId"
        name="tenantId"
        defaultValue={activeId}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="w-full rounded-md border border-border bg-surface px-2 py-1.5 text-sm"
      >
        {memberships.map((m) => (
          <option key={m.tenantId} value={m.tenantId}>
            {m.tenantName}
          </option>
        ))}
      </select>
    </form>
  );
}
