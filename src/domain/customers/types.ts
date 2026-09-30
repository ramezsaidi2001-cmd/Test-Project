export type CustomerKind = "particulier" | "entreprise";
export type IdDocumentType = "cin" | "passeport" | "carte_sejour";

export type Customer = {
  id: string;
  tenantId: string;
  kind: CustomerKind;
  firstName: string;
  lastName: string;
  companyName: string | null;
  /** Matricule fiscal (companies), e.g. "1234567/A/M/000". */
  taxId: string | null;
  idType: IdDocumentType;
  idNumber: string;
  nationality: string;
  birthDate: string | null;
  phone: string;
  email: string | null;
  address: string;
  city: string;
  licenseNumber: string;
  licenseIssueDate: string | null;
  licenseExpiry: string | null;
  blacklisted: boolean;
  blacklistReason: string | null;
  notes: string | null;
  createdAt: string;
};
