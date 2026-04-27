import { Injectable } from '@angular/core';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase/firebase.client';
import { CredentialVerificationResult } from '../models/credential-request.model';

interface VerifyCredentialPayload {
  token: string;
}

@Injectable({
  providedIn: 'root',
})
export class CredentialVerificationService {
  private readonly verifyCredentialCallable = httpsCallable<
    VerifyCredentialPayload,
    CredentialVerificationResult
  >(functions, 'verifyCredential');

  async verify(token: string): Promise<CredentialVerificationResult> {
    const result = await this.verifyCredentialCallable({ token });

    return result.data;
  }
}
