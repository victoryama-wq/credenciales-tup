import { Timestamp } from 'firebase/firestore';

export type CredentialTemplateKey = 'admin' | 'docente' | 'estudiante';
export type CredentialTemplateSide = 'front' | 'back';
export type CredentialTemplateFieldKey = 'photo' | 'name' | 'matricula' | 'nivel' | 'programa' | 'qr';

export interface CredentialTemplateFieldLayout {
  x: number;
  y: number;
  w: number;
  h: number;
  fontSize?: number;
  color?: string;
  hidden?: boolean;
}

export type CredentialTemplateLayouts = Record<
  CredentialTemplateKey,
  Record<CredentialTemplateFieldKey, CredentialTemplateFieldLayout>
>;

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
