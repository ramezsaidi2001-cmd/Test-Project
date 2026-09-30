import type { NextRequest } from "next/server";
import { can } from "@/domain/tenancy/permissions";
import { currentMonth, monthlyReport } from "@/server/reports/service";
import { getTenantContext } from "@/server/tenancy/context";

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

const dinars = (millimes: number) => (millimes / 1000).toFixed(3).replace(".", ",");
const decimal = (n: number, digits = 1) => n.toFixed(digits).replace(".", ",");

function cell(value: string | number) {
  const s = String(value);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(request: NextRequest) {
  const ctx = await getTenantContext();
  if (!can(ctx.role, "reports.view")) {
    return new Response("Accès refusé.", { status: 403, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }

  const param = request.nextUrl.searchParams.get("month");
  const month = param && MONTH_PATTERN.test(param) ? param : currentMonth();
  const report = monthlyReport(ctx, month);

  const header = [
    "Immatriculation",
    "Marque",
    "Modèle",
    "Jours loués",
    "Taux d'utilisation (%)",
    "CA HT (DT)",
    "RevPAV (DT)",
    "Coûts d'entretien (DT)",
    "Marge (DT)",
  ];
  const rows = report.byVehicle.map(({ vehicle, metrics, maintenanceCost, margin }) => [
    vehicle.plate,
    vehicle.make,
    vehicle.model,
    decimal(metrics.rentedDays),
    decimal(metrics.utilization * 100),
    dinars(metrics.revenue),
    dinars(metrics.revPav),
    dinars(maintenanceCost),
    dinars(margin),
  ]);

  const csv = "﻿" + [header, ...rows].map((r) => r.map(cell).join(";")).join("\r\n") + "\r\n";

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="rapport-vehicules-${month}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
