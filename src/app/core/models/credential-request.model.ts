import { Timestamp } from 'firebase/firestore';

export type CredentialRequestStatus =
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'REJECTED'
  | 'APPROVED_FOR_PRINT'
  | 'PRINTED'
  | 'READY_FOR_PICKUP'
  | 'DELIVERED';

export const credentialRequestStatuses: CredentialRequestStatus[] = [
  'SUBMITTED',
  'UNDER_REVIEW',
  'REJECTED',
  'APPROVED_FOR_PRINT',
  'PRINTED',
  'READY_FOR_PICKUP',
  'DELIVERED',
];

export const statusLabels: Record<CredentialRequestStatus, string> = {
  SUBMITTED: 'Enviada',
  UNDER_REVIEW: 'En revision',
  REJECTED: 'Rechazada',
  APPROVED_FOR_PRINT: 'Aprobada para impresion',
  PRINTED: 'Impresa',
  READY_FOR_PICKUP: 'Lista para entrega',
  DELIVERED: 'Entregada',
};

export interface CredentialDocument {
  type: 'photo' | 'evidence';
  name: string;
  url: string;
  storagePath: string;
  contentType: string;
}

export interface CredentialTimelineEvent {
  status: CredentialRequestStatus;
  actorUid: string;
  note?: string;
  timestamp: Timestamp;
}

export interface CredentialRequest {
  id: string;
  uid: string;
  studentId: string;
  name: string;
  email: string;
  career: string;
  cycle: string;
  phone: string;
  status: CredentialRequestStatus;
  photoUrl: string;
  documents: CredentialDocument[];
  reviewNotes?: string;
  rejectionReason?: string;
  credentialNumber?: string;
  qrToken?: string;
  printBatchId?: string;
  timeline: CredentialTimelineEvent[];
  submittedAt: Timestamp;
  updatedAt: Timestamp;
  reviewedAt?: Timestamp;
  printedAt?: Timestamp;
  deliveredAt?: Timestamp;
}

export interface CreateCredentialRequestInput {
  uid: string;
  email: string;
  studentId: string;
  name: string;
  career: string;
  cycle: string;
  phone: string;
  photo: File;
  evidence: File;
}
