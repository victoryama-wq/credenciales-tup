import { Injectable, NgZone, inject } from '@angular/core';
import {
  DocumentData,
  Query,
  QueryDocumentSnapshot,
  Timestamp,
  addDoc,
  arrayUnion,
  collection,
  doc,
  onSnapshot,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { Observable } from 'rxjs';
import { db, storage } from '../firebase/firebase.client';
import {
  CreateCredentialRequestInput,
  CredentialDocument,
  CredentialRequest,
  CredentialRequestStatus,
  CredentialTimelineEvent,
} from '../models/credential-request.model';

@Injectable({
  providedIn: 'root',
})
export class CredentialRequestService {
  private readonly zone = inject(NgZone);
  private readonly collectionRef = collection(db, 'credential_requests');

  watchRequestsByUser(uid: string): Observable<CredentialRequest[]> {
    const requestQuery = query(this.collectionRef, where('uid', '==', uid));

    return this.watchQuery(requestQuery);
  }

  watchAllRequests(): Observable<CredentialRequest[]> {
    return this.watchQuery(query(this.collectionRef));
  }

  async createRequest(input: CreateCredentialRequestInput): Promise<string> {
    const now = Timestamp.now();
    const basePath = `credential-requests/${input.uid}/${Date.now()}`;
    const photo = await this.uploadDocument(
      `${basePath}/photo-${this.safeName(input.photo.name)}`,
      input.photo,
      'photo'
    );
    const evidence = await this.uploadDocument(
      `${basePath}/evidence-${this.safeName(input.evidence.name)}`,
      input.evidence,
      'evidence'
    );

    const timeline: CredentialTimelineEvent[] = [
      {
        status: 'SUBMITTED',
        actorUid: input.uid,
        note: 'Solicitud enviada por estudiante.',
        timestamp: now,
      },
    ];

    const request = await addDoc(this.collectionRef, {
      uid: input.uid,
      email: input.email,
      studentId: input.studentId,
      name: input.name,
      career: input.career,
      cycle: input.cycle,
      phone: input.phone,
      status: 'SUBMITTED',
      photoUrl: photo.url,
      documents: [photo, evidence],
      timeline,
      submittedAt: now,
      updatedAt: now,
    });

    return request.id;
  }

  async updateStatus(
    requestId: string,
    status: CredentialRequestStatus,
    actorUid: string,
    note?: string
  ): Promise<void> {
    const now = Timestamp.now();
    const requestRef = doc(db, 'credential_requests', requestId);
    const changes: Record<string, unknown> = {
      status,
      updatedAt: now,
      timeline: arrayUnion({
        status,
        actorUid,
        note: note || '',
        timestamp: now,
      }),
    };

    if (status === 'UNDER_REVIEW' || status === 'APPROVED_FOR_PRINT' || status === 'REJECTED') {
      changes['reviewedAt'] = now;
      changes['reviewNotes'] = note || '';
    }

    if (status === 'REJECTED') {
      changes['rejectionReason'] = note || 'Solicitud rechazada por administracion.';
    }

    if (status === 'APPROVED_FOR_PRINT') {
      changes['credentialNumber'] = `CR-${new Date().getFullYear()}-${requestId.slice(0, 6).toUpperCase()}`;
      changes['qrToken'] = crypto.randomUUID();
    }

    if (status === 'PRINTED') {
      changes['printedAt'] = now;
    }

    if (status === 'DELIVERED') {
      changes['deliveredAt'] = now;
    }

    await updateDoc(requestRef, changes);
  }

  private async uploadDocument(
    storagePath: string,
    file: File,
    type: CredentialDocument['type']
  ): Promise<CredentialDocument> {
    const fileRef = ref(storage, storagePath);
    await uploadBytes(fileRef, file, { contentType: file.type });
    const url = await getDownloadURL(fileRef);

    return {
      type,
      name: file.name,
      url,
      storagePath,
      contentType: file.type || 'application/octet-stream',
    };
  }

  private watchQuery(requestQuery: Query<DocumentData>): Observable<CredentialRequest[]> {
    return new Observable((subscriber) => {
      const unsubscribe = onSnapshot(
        requestQuery,
        (snapshot) => {
          const requests = snapshot.docs
            .map((item) => this.fromSnapshot(item))
            .sort((a, b) => b.submittedAt.toMillis() - a.submittedAt.toMillis());

          this.zone.run(() => subscriber.next(requests));
        },
        (error) => this.zone.run(() => subscriber.error(error))
      );

      return unsubscribe;
    });
  }

  private fromSnapshot(snapshot: QueryDocumentSnapshot<DocumentData>): CredentialRequest {
    return {
      id: snapshot.id,
      ...snapshot.data(),
    } as CredentialRequest;
  }

  private safeName(fileName: string): string {
    return fileName.toLowerCase().replace(/[^a-z0-9.]+/g, '-');
  }
}
