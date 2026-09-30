import { DAY, formatDate } from "../shared/dates";
import type { Vehicle } from "./types";

export type AlertSeverity = "warning" | "danger";

export type FleetAlert = {
  key: string;
  kind: "assurance" | "visite_technique" | "vignette" | "entretien";
  severity: AlertSeverity;
  vehicleId: string;
  message: string;
};

export const DOCUMENT_HORIZON_DAYS = 30;
export const SERVICE_WARNING_KM = 1000;

const DOCS = [
  { kind: "assurance", field: "insuranceExpiry", label: "Assurance" },
  { kind: "visite_technique", field: "technicalInspectionExpiry", label: "Visite technique" },
  { kind: "vignette", field: "vignetteExpiry", label: "Vignette" },
] as const;

export function vehicleAlerts(vehicle: Vehicle, now: Date): FleetAlert[] {
  if (vehicle.status === "hors_service") return [];
  const alerts: FleetAlert[] = [];

  for (const doc of DOCS) {
    const expiry = new Date(vehicle.documents[doc.field]);
    const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / DAY);
    if (daysLeft <= DOCUMENT_HORIZON_DAYS) {
      alerts.push({
        key: `${vehicle.id}:${doc.kind}`,
        kind: doc.kind,
        severity: daysLeft < 0 ? "danger" : "warning",
        vehicleId: vehicle.id,
        message:
          daysLeft < 0
            ? `${doc.label} expirée depuis le ${formatDate(expiry)}`
            : `${doc.label} expire le ${formatDate(expiry)} (J-${daysLeft})`,
      });
    }
  }

  const kmLeft = vehicle.nextServiceKm - vehicle.mileage;
  if (kmLeft <= SERVICE_WARNING_KM) {
    alerts.push({
      key: `${vehicle.id}:entretien`,
      kind: "entretien",
      severity: kmLeft <= 0 ? "danger" : "warning",
      vehicleId: vehicle.id,
      message:
        kmLeft <= 0
          ? `Entretien dépassé de ${(-kmLeft).toLocaleString("fr-FR")} km`
          : `Entretien dans ${kmLeft.toLocaleString("fr-FR")} km`,
    });
  }

  return alerts;
}
