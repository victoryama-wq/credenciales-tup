import {
  institutionalEmailDomain,
  isInstitutionalEmail,
  normalizeEmailAddress,
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
});
