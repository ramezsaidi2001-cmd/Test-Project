import type { Permission } from "@/domain/tenancy/permissions";

export type NavItem = {
  label: string;
  href: string;
  permission?: Permission;
  section?: "operations" | "gestion" | "parametres";
};

export const NAV_ITEMS: NavItem[] = [
  { label: "Tableau de bord", href: "/dashboard", section: "operations" },
  { label: "Planning", href: "/planning", permission: "contracts.view", section: "operations" },
  { label: "Réservations", href: "/reservations", permission: "contracts.view", section: "operations" },
  { label: "Clients", href: "/customers", permission: "customers.view", section: "operations" },
  { label: "Flotte", href: "/fleet", permission: "fleet.view", section: "gestion" },
  { label: "Entretien", href: "/maintenance", permission: "maintenance.view", section: "gestion" },
  { label: "Facturation", href: "/billing", permission: "finance.view", section: "gestion" },
  { label: "Rapports", href: "/reports", permission: "reports.view", section: "gestion" },
  { label: "Paramètres", href: "/settings", permission: "tenant.manage", section: "parametres" },
  { label: "Équipe", href: "/settings/team", permission: "members.view", section: "parametres" },
];

export const NAV_SECTIONS: Record<NonNullable<NavItem["section"]>, string> = {
  operations: "Opérations",
  gestion: "Gestion",
  parametres: "Administration",
};
