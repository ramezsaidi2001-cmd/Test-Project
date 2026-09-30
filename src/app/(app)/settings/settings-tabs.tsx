import { Tabs } from "@/components/ui";

export type SettingsTab = "agence" | "tarifs" | "agences" | "equipe";

const TABS: { value: SettingsTab; label: string; href: string }[] = [
  { value: "agence", label: "Agence", href: "/settings" },
  { value: "tarifs", label: "Tarifs & saisons", href: "/settings/tarifs" },
  { value: "agences", label: "Agences & points de retrait", href: "/settings/agences" },
  { value: "equipe", label: "Équipe", href: "/settings/team" },
];

/** Sub-navigation shared by the settings pages (tenant.manage only). */
export function SettingsTabs({ current }: { current: SettingsTab }) {
  return <Tabs tabs={TABS} current={current} />;
}
