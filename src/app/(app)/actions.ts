"use server";

import { redirect } from "next/navigation";
import { isDemoMode } from "@/server/auth/demo";
import { requireUser } from "@/server/auth/session";
import { resetDemoData } from "@/server/settings/service";
import { getMemberships, requirePermission, setActiveTenantCookie } from "@/server/tenancy/context";

export async function switchTenant(formData: FormData) {
  const user = await requireUser();
  const tenantId = formData.get("tenantId");
  const memberships = await getMemberships(user.id);

  // Only switch to a tenant the user actually belongs to.
  if (typeof tenantId === "string" && memberships.some((m) => m.tenantId === tenantId)) {
    await setActiveTenantCookie(tenantId);
  }

  redirect("/dashboard");
}

export async function resetDemo() {
  const ctx = await requirePermission("tenant.manage");
  if (isDemoMode()) resetDemoData(ctx);
  redirect("/dashboard");
}
