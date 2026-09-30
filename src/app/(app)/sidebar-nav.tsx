"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_SECTIONS, type NavItem } from "./navigation";

export function SidebarNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  // Longest matching href wins, so /settings/team doesn't also highlight /settings.
  const activeHref = items
    .filter((i) => pathname === i.href || pathname.startsWith(`${i.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  const sections = Object.entries(NAV_SECTIONS)
    .map(([key, title]) => ({ key, title, items: items.filter((i) => i.section === key) }))
    .filter((s) => s.items.length > 0);

  return (
    <nav aria-label="Navigation principale" className="flex gap-1 overflow-x-auto md:flex-col md:gap-4">
      {sections.map((section) => (
        <div key={section.key} className="flex gap-1 md:flex-col">
          <p className="hidden px-3 text-[11px] font-medium uppercase tracking-wide text-muted md:block">{section.title}</p>
          {section.items.map((item) => {
            const active = item.href === activeHref;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`shrink-0 rounded-md px-3 py-2 text-sm font-medium transition ${
                  active ? "bg-primary/10 text-primary" : "text-foreground hover:bg-border/60"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
