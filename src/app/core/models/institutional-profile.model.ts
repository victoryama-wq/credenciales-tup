import { Timestamp } from 'firebase/firestore';
import { CredentialApplicantType } from './credential-request.model';

export type InstitutionalAcademicStatus =
  | 'ACTIVE'
  | 'WITHDRAWN'
  | 'GRADUATED'
  | 'SUSPENDED';

export type InstitutionalProfileSource = 'SAEKO' | 'ADMIN' | 'EMAIL_PATTERN';

export const institutionalAcademicStatusLabels: Record<InstitutionalAcademicStatus, string> = {
  ACTIVE: 'Activo',
  WITHDRAWN: 'Baja',
  GRADUATED: 'Egresado',
  SUSPENDED: 'Suspendido',
};

export interface InstitutionalProfile {
  id: string;
  email: string;
  applicantType: CredentialApplicantType;
  academicStatus: InstitutionalAcademicStatus;
  name: string;
  studentId?: string;
  career?: string;
  currentTerm?: string;
  position?: string;
  active: boolean;
  source: InstitutionalProfileSource;
  importedAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface SaekoImportRow {
  rowNumber: number;
  email: string;
  applicantType: CredentialApplicantType;
  academicStatus: InstitutionalAcademicStatus;
  name: string;
  studentId?: string;
  career?: string;
  currentTerm?: string;
  position?: string;
}

export interface SaekoImportResult {
  ok: boolean;
  imported: number;
  total: number;
}
