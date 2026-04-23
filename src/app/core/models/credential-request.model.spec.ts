import {
  allowedStatusTransitions,
  canTransitionCredentialRequestStatus,
} from './credential-request.model';

describe('CredentialRequest status transitions', () => {
  it('allows only the expected MVP workflow transitions', () => {
    expect(canTransitionCredentialRequestStatus('SUBMITTED', 'UNDER_REVIEW')).toBe(true);
    expect(canTransitionCredentialRequestStatus('SUBMITTED', 'APPROVED_FOR_PRINT')).toBe(false);
    expect(canTransitionCredentialRequestStatus('APPROVED_FOR_PRINT', 'PRINTED')).toBe(true);
    expect(canTransitionCredentialRequestStatus('DELIVERED', 'READY_FOR_PICKUP')).toBe(false);
  });

  it('keeps delivered as a terminal status', () => {
    expect(allowedStatusTransitions.DELIVERED).toEqual([]);
  });
});
