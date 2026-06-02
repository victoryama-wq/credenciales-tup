import {
  institutionalEmailDomain,
  isInstitutionalEmail,
  normalizeEmailAddress,
  resolveApplicantTypeByEmail,
} from './institutional-email.util';

describe('institutional email policy', () => {
  it('normalizes addresses before validation', () => {
    expect(normalizeEmailAddress('  VICTOR.YAMA@TECPLAYACAR.EDU.MX ')).toBe(
      'victor.yama@tecplayacar.edu.mx'
    );
  });

  it('accepts the institutional domain only', () => {
    expect(isInstitutionalEmail(`alumno@${institutionalEmailDomain}`)).toBe(true);
    expect(isInstitutionalEmail('alumno@gmail.com')).toBe(false);
    expect(isInstitutionalEmail('')).toBe(false);
  });

  it('detects applicant type by institutional email pattern', () => {
    expect(resolveApplicantTypeByEmail('tup3042@tecplayacar.edu.mx')).toBe('STUDENT');
    expect(resolveApplicantTypeByEmail('tup-d17@tecplayacar.edu.mx')).toBe('TEACHER');
    expect(resolveApplicantTypeByEmail('tup-d2503@tecplayacar.edu.mx')).toBe('TEACHER');
    expect(resolveApplicantTypeByEmail('zulma.martinez@tecplayacar.edu.mx')).toBe('STAFF');
  });
});
