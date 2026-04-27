import { Injectable, NgZone, inject } from '@angular/core';
import {
  DocumentData,
  DocumentSnapshot,
  doc,
  onSnapshot,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { Observable } from 'rxjs';
import { db, functions } from '../firebase/firebase.client';
import {
  InstitutionalProfile,
  SaekoImportResult,
  SaekoImportRow,
} from '../models/institutional-profile.model';

interface ImportInstitutionalProfilesPayload {
  rows: SaekoImportRow[];
}

@Injectable({
  providedIn: 'root',
})
export class InstitutionalProfileService {
  private readonly zone = inject(NgZone);

  watchProfileByEmail(email: string): Observable<InstitutionalProfile | null> {
    const normalizedEmail = email.trim().toLowerCase();
    const profileRef = doc(db, 'institutional_profiles', normalizedEmail);

    return new Observable((subscriber) => {
      const unsubscribe = onSnapshot(
        profileRef,
        (snapshot) => {
          this.zone.run(() => subscriber.next(this.fromSnapshot(snapshot)));
        },
        (error) => this.zone.run(() => subscriber.error(error))
      );

      return unsubscribe;
    });
  }

  async importSaekoProfiles(rows: SaekoImportRow[]): Promise<SaekoImportResult> {
    const importInstitutionalProfiles = httpsCallable<
      ImportInstitutionalProfilesPayload,
      SaekoImportResult
    >(functions, 'importInstitutionalProfiles');
    const result = await importInstitutionalProfiles({ rows });

    return result.data;
  }

  private fromSnapshot(snapshot: DocumentSnapshot<DocumentData>): InstitutionalProfile | null {
    if (!snapshot.exists()) {
      return null;
    }

    return {
      id: snapshot.id,
      ...snapshot.data(),
    } as InstitutionalProfile;
  }
}
