import { Injectable, NgZone, inject } from '@angular/core';
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { Observable } from 'rxjs';
import { db, storage } from '../firebase/firebase.client';
import {
  CredentialTemplateAsset,
  CredentialTemplateFieldKey,
  CredentialTemplateFieldLayout,
  CredentialTemplateKey,
  CredentialTemplateLayouts,
  CredentialTemplateSettings,
  CredentialTemplateUploadTarget,
} from '../models/credential-template.model';

@Injectable({
  providedIn: 'root',
})
export class CredentialTemplateService {
  private readonly zone = inject(NgZone);
  private readonly settingsRef = doc(db, 'credential_template_settings', 'current');
  private readonly layoutsRef = doc(db, 'credential_template_settings', 'layouts');

  watchSettings(): Observable<CredentialTemplateSettings> {
    return new Observable((subscriber) => {
      const unsubscribe = onSnapshot(
        this.settingsRef,
        (snapshot) => {
          const settings = (snapshot.data() || {}) as CredentialTemplateSettings;
          this.zone.run(() => subscriber.next(settings));
        },
        (error) => this.zone.run(() => subscriber.error(error))
      );

      return unsubscribe;
    });
  }

  watchLayouts(): Observable<Partial<CredentialTemplateLayouts>> {
    return new Observable((subscriber) => {
      const unsubscribe = onSnapshot(
        this.layoutsRef,
        (snapshot) => {
          const data = snapshot.data() as
            | { layouts?: Partial<CredentialTemplateLayouts> }
            | undefined;
          this.zone.run(() => subscriber.next(data?.layouts || {}));
        },
        (error) => this.zone.run(() => subscriber.error(error))
      );

      return unsubscribe;
    });
  }

  async saveLayouts(layouts: CredentialTemplateLayouts): Promise<void> {
    await setDoc(
      this.layoutsRef,
      {
        layouts: this.serializeLayouts(layouts),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  }

  async uploadTemplateAsset(target: CredentialTemplateUploadTarget): Promise<CredentialTemplateAsset> {
    const contentType = this.templateContentType(target.file);

    if (!contentType) {
      throw new Error('El diseno debe ser PNG o SVG.');
    }

    const extension = contentType === 'image/svg+xml' ? 'svg' : 'png';
    const storagePath = `credential-templates/${target.key}-${target.side}.${extension}`;
    const fileRef = ref(storage, storagePath);

    await uploadBytes(fileRef, target.file, { contentType });
    const url = await getDownloadURL(fileRef);

    const asset: Omit<CredentialTemplateAsset, 'updatedAt'> = {
      name: target.file.name,
      url,
      storagePath,
      contentType,
      size: target.file.size,
    };

    await setDoc(
      this.settingsRef,
      {
        [target.key]: {
          [target.side]: {
            ...asset,
            updatedAt: serverTimestamp(),
          },
        },
      },
      { merge: true }
    );

    return asset;
  }

  private templateContentType(file: File): 'image/png' | 'image/svg+xml' | '' {
    if (file.type === 'image/png' || file.type === 'image/svg+xml') {
      return file.type;
    }

    const fileName = file.name.toLowerCase();

    if (fileName.endsWith('.png')) {
      return 'image/png';
    }

    if (fileName.endsWith('.svg')) {
      return 'image/svg+xml';
    }

    return '';
  }

  private serializeLayouts(
    layouts: CredentialTemplateLayouts
  ): Record<
    CredentialTemplateKey,
    Record<CredentialTemplateFieldKey, CredentialTemplateFieldLayout>
  > {
    return {
      admin: this.serializeLayoutGroup(layouts.admin),
      docente: this.serializeLayoutGroup(layouts.docente),
      estudiante: this.serializeLayoutGroup(layouts.estudiante),
    };
  }

  private serializeLayoutGroup(
    group: Record<CredentialTemplateFieldKey, CredentialTemplateFieldLayout>
  ): Record<CredentialTemplateFieldKey, CredentialTemplateFieldLayout> {
    return {
      photo: this.serializeLayout(group.photo),
      name: this.serializeLayout(group.name),
      matricula: this.serializeLayout(group.matricula),
      nivel: this.serializeLayout(group.nivel),
      programa: this.serializeLayout(group.programa),
      qr: this.serializeLayout(group.qr),
    };
  }

  private serializeLayout(layout: CredentialTemplateFieldLayout): CredentialTemplateFieldLayout {
    const serialized: CredentialTemplateFieldLayout = {
      x: layout.x,
      y: layout.y,
      w: layout.w,
      h: layout.h,
    };

    if (layout.fontSize !== undefined) {
      serialized.fontSize = layout.fontSize;
    }

    if (layout.color) {
      serialized.color = layout.color;
    }

    if (layout.hidden !== undefined) {
      serialized.hidden = layout.hidden;
    }

    return serialized;
  }
}
