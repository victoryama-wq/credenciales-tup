import { Timestamp } from 'firebase/firestore';

export type CredentialTemplateKey = 'admin' | 'docente' | 'estudiante';
export type CredentialTemplateSide = 'front' | 'back';

export interface CredentialTemplateAsset {
  name: string;
  url: string;
  storagePath: string;
  contentType: string;
  size: number;
  updatedAt?: Timestamp;
}

export type CredentialTemplateSettings = Partial<
  Record<CredentialTemplateKey, Partial<Record<CredentialTemplateSide, CredentialTemplateAsset>>>
>;

export interface CredentialTemplateUploadTarget {
  key: CredentialTemplateKey;
  side: CredentialTemplateSide;
  file: File;
}
