import { Timestamp } from 'firebase/firestore';
import type { CredentialRequestStatus } from './credential-request.model';

export type PrintBatchStatus = 'CREATED' | 'PRINTED' | 'READY_FOR_PICKUP';
export type PrintBatchLifecycle = 'IN_PROGRESS' | 'READY_FOR_PICKUP' | 'DELIVERED';

export const printBatchStatusLabels: Record<PrintBatchStatus, string> = {
  CREATED: 'Creado',
  PRINTED: 'Impreso',
  READY_FOR_PICKUP: 'Listo para entrega',
};

export interface PrintBatch {
  id: string;
  createdBy: string;
  requestIds: string[];
  status: PrintBatchStatus;
  total: number;
  note?: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  printedAt?: Timestamp;
  printedBy?: string;
  readyForPickupAt?: Timestamp;
  readyForPickupBy?: string;
}

export interface PrintBatchRequestStatusSummary {
  pending: number;
  printed: number;
  readyForPickup: number;
  delivered: number;
  incompatible: number;
}

export function summarizePrintBatchRequestStatuses(
  statuses: CredentialRequestStatus[],
): PrintBatchRequestStatusSummary {
  const summary: PrintBatchRequestStatusSummary = {
    pending: 0,
    printed: 0,
    readyForPickup: 0,
    delivered: 0,
    incompatible: 0,
  };

  for (const status of statuses) {
    if (status === 'APPROVED_FOR_PRINT') {
      summary.pending++;
    } else if (status === 'PRINTED') {
      summary.printed++;
    } else if (status === 'READY_FOR_PICKUP') {
      summary.readyForPickup++;
    } else if (status === 'DELIVERED') {
      summary.delivered++;
    } else {
      summary.incompatible++;
    }
  }

  return summary;
}

export function derivePrintBatchLifecycle(
  batchStatus: PrintBatchStatus,
  expectedRequests: number,
  statuses: CredentialRequestStatus[],
): PrintBatchLifecycle {
  const allRequestsResolved = expectedRequests > 0 && statuses.length === expectedRequests;

  if (allRequestsResolved && statuses.every((status) => status === 'DELIVERED')) {
    return 'DELIVERED';
  }

  if (
    allRequestsResolved &&
    statuses.every((status) => status === 'READY_FOR_PICKUP' || status === 'DELIVERED')
  ) {
    return 'READY_FOR_PICKUP';
  }

  if (batchStatus === 'READY_FOR_PICKUP') {
    return 'READY_FOR_PICKUP';
  }

  return 'IN_PROGRESS';
}

export function isIndividualPrintManagedByBatch(
  currentStatus: CredentialRequestStatus,
  nextStatus: CredentialRequestStatus,
  printBatchId?: string,
): boolean {
  return (
    currentStatus === 'APPROVED_FOR_PRINT' && nextStatus === 'PRINTED' && Boolean(printBatchId)
  );
}
