export const institutionalEmailDomain = 'tecplayacar.edu.mx';

export function normalizeEmailAddress(email: string | null | undefined): string {
  return (email ?? '').trim().toLowerCase();
}

export function isInstitutionalEmail(email: string | null | undefined): boolean {
  const normalized = normalizeEmailAddress(email);

  return !!normalized && normalized.endsWith(`@${institutionalEmailDomain}`);
}
