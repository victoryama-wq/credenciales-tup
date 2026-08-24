import { describe, expect, it } from 'vitest';
import {
  isIndividualPrintManagedByBatch,
  summarizePrintBatchRequestStatuses,
} from './print-batch.model';

describe('print batch request status summary', () => {
  it('separates pending requests from preserved downstream statuses', () => {
    const summary = summarizePrintBatchRequestStatuses([
      'APPROVED_FOR_PRINT',
      'APPROVED_FOR_PRINT',
      'PRINTED',
      'READY_FOR_PICKUP',
      'DELIVERED',
    ]);

    expect(summary).toEqual({
      pending: 2,
      printed: 1,
      readyForPickup: 1,
      delivered: 1,
      incompatible: 0,
    });
  });

  it('reports statuses that cannot be reconciled by closing a batch', () => {
    const summary = summarizePrintBatchRequestStatuses(['SUBMITTED', 'UNDER_REVIEW', 'REJECTED']);

    expect(summary.incompatible).toBe(3);
    expect(summary.pending).toBe(0);
  });

  it('delegates individual printing to the linked batch', () => {
    expect(isIndividualPrintManagedByBatch('APPROVED_FOR_PRINT', 'PRINTED', 'batch-1')).toBe(true);
    expect(isIndividualPrintManagedByBatch('APPROVED_FOR_PRINT', 'PRINTED')).toBe(false);
    expect(isIndividualPrintManagedByBatch('PRINTED', 'READY_FOR_PICKUP', 'batch-1')).toBe(false);
  });
});
