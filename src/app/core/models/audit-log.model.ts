import { Timestamp } from 'firebase/firestore';

export type AuditLogEntity =
  | 'credential_requests'
  | 'print_batches'
  | 'institutional_profiles'
  | string;

export interface AuditLog {
  id: string;
  actorUid: string;
  action: string;
  entity: AuditLogEntity;
  entityId: string;
  before: unknown;
  after: unknown;
  timestamp: Timestamp;
}

export const auditEntityLabels: Record<string, string> = {
  credential_requests: 'Solicitudes',
  print_batches: 'Lotes de impresion',
  institutional_profiles: 'Perfiles institucionales',
};

export const auditActionLabels: Record<string, string> = {
  'credential_request.create': 'Solicitud creada',
  'credential_request.status_changed': 'Cambio de estatus',
  'credential_request.batch_printed': 'Credencial impresa por lote',
  'print_batch.create': 'Lote creado',
  'print_batch.printed': 'Lote marcado como impreso',
  'institutional_profiles.import': 'Importacion Saeko',
};
