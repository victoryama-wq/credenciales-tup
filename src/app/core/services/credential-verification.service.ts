import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { CredentialVerificationResult } from '../models/credential-request.model';

interface VerifyCredentialPayload {
  token: string;
}

interface CallableResponse<T> {
  result?: T;
  error?: {
    message?: string;
    status?: string;
  };
}

@Injectable({
  providedIn: 'root',
})
export class CredentialVerificationService {
  private readonly endpoint = environment.useEmulators
    ? `http://127.0.0.1:5001/${environment.firebase.projectId}/${environment.functionsRegion}/verifyCredential`
    : `https://${environment.functionsRegion}-${environment.firebase.projectId}.cloudfunctions.net/verifyCredential`;

  private readonly timeoutMs = 12000;

  async verify(token: string): Promise<CredentialVerificationResult> {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        mode: 'cors',
        credentials: 'omit',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ data: { token } }),
        signal: controller.signal,
      });

      const payload = (await response.json()) as CallableResponse<CredentialVerificationResult>;

      if (!response.ok || payload.error) {
        throw new Error(
          payload.error?.message || 'No fue posible consultar la credencial en este momento.',
        );
      }

      if (!payload.result) {
        throw new Error('La respuesta de verificación llegó incompleta.');
      }

      return payload.result;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new Error('La verificación tardó demasiado. Revisa tu conexión e intenta de nuevo.');
      }

      throw error;
    } finally {
      window.clearTimeout(timeout);
    }
  }
}
