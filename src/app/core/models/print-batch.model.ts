import { Timestamp } from 'firebase/firestore';

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
