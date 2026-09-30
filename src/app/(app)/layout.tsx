import Link from "next/link";
import { ConfirmSubmit } from "@/components/client";
import { Button, Logo } from "@/components/ui";
import { can } from "@/domain/tenancy/permissions";
import { PLAN_LABELS, ROLE_LABELS } from "@/domain/tenancy/roles";
import { isDemoMode } from "@/server/auth/demo";
import { getTenantContext } from "@/server/tenancy/context";
import { signOut } from "../(auth)/actions";
import { resetDemo } from "./actions";
import { NAV_ITEMS } from "./navigation";
import { SidebarNav } from "./sidebar-nav";
import { TenantSwitcher } from "./tenant-switcher";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const ctx = await getTenantContext();
  const items = NAV_ITEMS.filter((item) => !item.permission || can(ctx.role, item.permission));
  const demo = isDemoMode();

  return (
    <div className="flex flex-1 flex-col">
      {demo && (
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 bg-primary px-4 py-1.5 text-center text-xs text-primary-foreground print:hidden">
          <span>
            Mode démo — données fictives. Connecté en tant que <strong>{ctx.user.name}</strong> ({ROLE_LABELS[ctx.role]}).
          </span>
          <form action={signOut}>
            <button type="submit" className="underline underline-offset-2">
              Changer de rôle
            </button>
          </form>
          {can(ctx.role, "tenant.manage") && (
            <form action={resetDemo}>
              <ConfirmSubmit
                variant="ghost"
                className="!px-2 !py-0 text-xs !text-primary-foreground underline underline-offset-2 hover:!bg-transparent"
                message="Réinitialiser toutes les données de démonstration ?"
              >
                Réinitialiser les données
              </ConfirmSubmit>
            </form>
          )}
        </div>
      )}

      <div className="flex flex-1 flex-col md:flex-row">
        <aside className="flex flex-col gap-4 border-b border-border bg-surface p-4 print:hidden md:sticky md:top-0 md:h-screen md:w-60 md:shrink-0 md:overflow-y-auto md:border-r md:border-b-0">
          <Link href="/dashboard">
            <Logo />
          </Link>

          <div className="space-y-1">
            {ctx.memberships.length > 1 ? (
              <TenantSwitcher memberships={ctx.memberships} activeId={ctx.tenant.id} />
            ) : (
              <p className="truncate text-sm font-medium">{ctx.tenant.name}</p>
            )}
            <p className="text-xs text-muted">
              {ROLE_LABELS[ctx.role]} · Offre {PLAN_LABELS[ctx.tenant.plan]}
            </p>
          </div>

          <SidebarNav items={items} />

          <div className="mt-auto hidden space-y-2 border-t border-border pt-4 md:block">
            <p className="truncate text-sm font-medium">{ctx.user.name}</p>
            <p className="truncate text-xs text-muted" title={ctx.user.email ?? undefined}>
              {ctx.user.email}
            </p>
            <div className="flex items-center justify-between">
              {!demo && (
                <Link href="/onboarding" className="text-xs text-primary hover:underline">
                  Nouvelle agence
                </Link>
              )}
              <form action={signOut} className="ml-auto">
                <Button type="submit" variant="ghost" className="px-2 py-1 text-xs">
                  Se déconnecter
                </Button>
              </form>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>

        <form action={signOut} className="border-t border-border p-4 print:hidden md:hidden">
          <Button type="submit" variant="ghost" className="w-full">
            Se déconnecter
          </Button>
        </form>
      </div>
    </div>
  );
}
