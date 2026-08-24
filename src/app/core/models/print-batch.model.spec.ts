import { describe, expect, it } from 'vitest';
import {
  derivePrintBatchLifecycle,
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

  it('moves a legacy printed batch to history when every credential was delivered manually', () => {
    expect(derivePrintBatchLifecycle('PRINTED', 3, ['DELIVERED', 'DELIVERED', 'DELIVERED'])).toBe(
      'DELIVERED',
    );
  });

  it('moves a legacy printed batch to history when every credential reached delivery stages', () => {
    expect(
      derivePrintBatchLifecycle('PRINTED', 3, [
        'READY_FOR_PICKUP',
        'DELIVERED',
        'READY_FOR_PICKUP',
      ]),
    ).toBe('READY_FOR_PICKUP');
  });

  it('keeps the batch in process while at least one credential is still printed', () => {
    expect(
      derivePrintBatchLifecycle('PRINTED', 3, ['READY_FOR_PICKUP', 'PRINTED', 'DELIVERED']),
    ).toBe('IN_PROGRESS');
  });

  it('keeps the batch visible when not every referenced request has loaded', () => {
    expect(derivePrintBatchLifecycle('PRINTED', 3, ['DELIVERED', 'DELIVERED'])).toBe('IN_PROGRESS');
  });
});
