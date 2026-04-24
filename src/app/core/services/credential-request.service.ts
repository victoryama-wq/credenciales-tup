import { Injectable, NgZone, inject } from '@angular/core';
import {
  DocumentData,
  Query,
  QueryDocumentSnapshot,
  collection,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { Observable } from 'rxjs';
import { db, functions, storage } from '../firebase/firebase.client';
import {
  CreateCredentialRequestInput,
  CredentialApplicantType,
  CredentialDocument,
  CredentialRequest,
  CredentialRequestStatus,
  CredentialRequestType,
} from '../models/credential-request.model';

interface CreateCredentialRequestPayload {
  applicantType: CredentialApplicantType;
  requestType: CredentialRequestType;
  email: string;
  studentId: string;
  name: string;
  career: string;
  cycle: string;
  phone: string;
  photo: CredentialDocument;
  evidence?: CredentialDocument;
}

interface CreateCredentialRequestResponse {
  requestId: string;
}

interface UpdateCredentialRequestStatusPayload {
  requestId: string;
  status: CredentialRequestStatus;
  note?: string;
}

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
    const basePath = `credential-requests/${input.uid}/${Date.now()}`;
    const photo = await this.uploadDocument(
      `${basePath}/photo-${this.safeName(input.photo.name)}`,
      input.photo,
      'photo'
    );
    const evidence = input.evidence
      ? await this.uploadDocument(
          `${basePath}/evidence-${this.safeName(input.evidence.name)}`,
          input.evidence,
          'evidence'
        )
      : undefined;
    const createCredentialRequest = httpsCallable<
      CreateCredentialRequestPayload,
      CreateCredentialRequestResponse
    >(functions, 'createCredentialRequest');
    const result = await createCredentialRequest({
      applicantType: input.applicantType,
      requestType: input.requestType,
      email: input.email,
      studentId: input.studentId,
      name: input.name,
      career: input.career,
      cycle: input.cycle,
      phone: input.phone,
      photo,
      evidence,
    });

    return result.data.requestId;
  }

  async updateStatus(
    requestId: string,
    status: CredentialRequestStatus,
    note?: string
  ): Promise<void> {
    const updateCredentialRequestStatus = httpsCallable<
      UpdateCredentialRequestStatusPayload,
      { ok: boolean }
    >(functions, 'updateCredentialRequestStatus');

    await updateCredentialRequestStatus({
      requestId,
      status,
      note,
    });
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
