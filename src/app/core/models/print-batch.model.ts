import { Timestamp } from 'firebase/firestore';
import type { CredentialRequestStatus } from './credential-request.model';

export type PrintBatchStatus = 'CREATED' | 'PRINTED';

export const printBatchStatusLabels: Record<PrintBatchStatus, string> = {
  CREATED: 'Creado',
  PRINTED: 'Impreso',
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

export function isIndividualPrintManagedByBatch(
  currentStatus: CredentialRequestStatus,
  nextStatus: CredentialRequestStatus,
  printBatchId?: string,
): boolean {
  return (
    currentStatus === 'APPROVED_FOR_PRINT' && nextStatus === 'PRINTED' && Boolean(printBatchId)
  );
}
