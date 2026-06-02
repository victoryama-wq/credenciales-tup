import { CredentialApplicantType } from '../models/credential-request.model';

export const institutionalEmailDomain = 'tecplayacar.edu.mx';

export function normalizeEmailAddress(email: string | null | undefined): string {
  return (email ?? '').trim().toLowerCase();
}

export function isInstitutionalEmail(email: string | null | undefined): boolean {
  const normalized = normalizeEmailAddress(email);

  return !!normalized && normalized.endsWith(`@${institutionalEmailDomain}`);
}

export function resolveApplicantTypeByEmail(
  email: string | null | undefined
): CredentialApplicantType {
  const account = normalizeEmailAddress(email).split('@')[0] || '';

  if (/^tup-d\d+$/.test(account)) {
    return 'TEACHER';
  }

  if (/^tup\d{4,}$/.test(account)) {
    return 'STUDENT';
  }

  return 'STAFF';
}
