import { Injectable, NgZone, inject } from '@angular/core';
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { Observable } from 'rxjs';
import { db, storage } from '../firebase/firebase.client';
import {
  CredentialTemplateAsset,
  CredentialTemplateSettings,
  CredentialTemplateUploadTarget,
} from '../models/credential-template.model';

@Injectable({
  providedIn: 'root',
})
export class CredentialTemplateService {
  private readonly zone = inject(NgZone);
  private readonly settingsRef = doc(db, 'credential_template_settings', 'current');

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
}
