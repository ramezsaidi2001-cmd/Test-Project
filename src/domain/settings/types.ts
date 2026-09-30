import type { Millimes } from "../shared/money";

export type AgencySettings = {
  tenantId: string;
  tradeName: string;
  legalName: string;
  taxId: string; // matricule fiscal
  rne: string; // registre national des entreprises
  address: string;
  city: string;
  phone: string;
  email: string;
  tvaBp: number; // 1900 = 19 %
  timbre: Millimes; // timbre fiscal per invoice
  fuelChargePerEighth: Millimes; // HT, per missing 1/8 tank
  lateGraceMinutes: number;
  paymentTermDays: number;
  contractTerms: string;
  invoiceFooter: string;
};
