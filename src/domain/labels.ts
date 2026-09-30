import type { InvoiceStatus, PaymentMethod } from "./billing/types";
import type { CustomerKind, IdDocumentType } from "./customers/types";
import type { FuelType, MileageSource, Transmission, VehicleStatus } from "./fleet/types";
import type { WorkOrderStatus, WorkOrderType } from "./maintenance/types";
import type { ContractStatus, DepositMethod, DepositStatus } from "./rentals/types";

export type Tone = "neutral" | "success" | "warning" | "danger" | "info";

export const VEHICLE_STATUS: Record<VehicleStatus, { label: string; tone: Tone }> = {
  disponible: { label: "Disponible", tone: "success" },
  loue: { label: "Loué", tone: "info" },
  maintenance: { label: "En entretien", tone: "warning" },
  hors_service: { label: "Hors service", tone: "danger" },
};

export const FUEL_TYPE: Record<FuelType, string> = {
  essence: "Essence",
  diesel: "Diesel",
  hybride: "Hybride",
  electrique: "Électrique",
};

export const TRANSMISSION: Record<Transmission, string> = {
  manuelle: "Manuelle",
  automatique: "Automatique",
};

export const MILEAGE_SOURCE: Record<MileageSource, string> = {
  depart: "Départ location",
  retour: "Retour location",
  entretien: "Entretien",
  manuel: "Relevé manuel",
};

export const CUSTOMER_KIND: Record<CustomerKind, string> = {
  particulier: "Particulier",
  entreprise: "Entreprise",
};

export const ID_DOCUMENT: Record<IdDocumentType, string> = {
  cin: "CIN",
  passeport: "Passeport",
  carte_sejour: "Carte de séjour",
};

export const CONTRACT_STATUS: Record<ContractStatus, { label: string; tone: Tone }> = {
  reservee: { label: "Réservée", tone: "info" },
  en_cours: { label: "En cours", tone: "warning" },
  retournee: { label: "Retournée", tone: "neutral" },
  cloturee: { label: "Clôturée", tone: "success" },
  annulee: { label: "Annulée", tone: "danger" },
};

export const DEPOSIT_METHOD: Record<DepositMethod, string> = {
  especes: "Espèces",
  carte: "Empreinte carte bancaire",
  cheque: "Chèque de garantie",
};

export const DEPOSIT_STATUS: Record<DepositStatus, string> = {
  en_attente: "En attente",
  bloquee: "Encaissée / bloquée",
  restituee: "Restituée",
  retenue: "Retenue",
};

export const WORK_ORDER_TYPE: Record<WorkOrderType, string> = {
  entretien_preventif: "Entretien préventif",
  reparation: "Réparation mécanique",
  carrosserie: "Carrosserie",
  pneumatiques: "Pneumatiques",
  visite_technique: "Visite technique",
};

export const WORK_ORDER_STATUS: Record<WorkOrderStatus, { label: string; tone: Tone }> = {
  ouvert: { label: "Ouvert", tone: "info" },
  en_cours: { label: "En cours", tone: "warning" },
  termine: { label: "Terminé", tone: "success" },
};

export const PAYMENT_METHOD: Record<PaymentMethod, string> = {
  especes: "Espèces",
  carte: "Carte bancaire (TPE)",
  cheque: "Chèque",
  virement: "Virement bancaire",
  d17: "D17 (La Poste)",
};

export const INVOICE_STATUS: Record<InvoiceStatus | "en_retard", { label: string; tone: Tone }> = {
  emise: { label: "Émise", tone: "info" },
  partiellement_payee: { label: "Partiellement payée", tone: "warning" },
  payee: { label: "Payée", tone: "success" },
  annulee: { label: "Annulée", tone: "neutral" },
  en_retard: { label: "En retard", tone: "danger" },
};

export const FUEL_LEVELS = [0, 1, 2, 3, 4, 5, 6, 7, 8] as const;
export const fuelLabel = (eighths: number) => (eighths === 8 ? "Plein" : eighths === 0 ? "Vide" : `${eighths}/8`);
