import { Injectable } from '@angular/core';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase/firebase.client';
import { AdminUser } from '../models/admin-user.model';

interface AdminUsersResponse {
  admins: AdminUser[];
}

interface AdminUserPayload {
  email: string;
  name?: string;
}

@Injectable({
  providedIn: 'root',
})
export class AdminUserService {
  private readonly callableTimeoutMs = 20000;

  async listAdmins(): Promise<AdminUser[]> {
    const listAdminUsers = httpsCallable<void, AdminUsersResponse>(functions, 'listAdminUsers');
    const result = await this.withTimeout(
      listAdminUsers(),
      'La carga de administradores esta tardando mas de lo esperado. Intenta de nuevo.',
    );

    return result.data.admins;
  }

  async addAdmin(email: string, name: string): Promise<AdminUser> {
    const addAdminUser = httpsCallable<AdminUserPayload, { admin: AdminUser }>(
      functions,
      'addAdminUser',
    );
    const result = await this.withTimeout(
      addAdminUser({ email, name }),
      'Agregar administrador esta tardando mas de lo esperado. Revisa si el cambio aparece e intenta de nuevo.',
    );

    return result.data.admin;
  }

  async removeAdmin(email: string): Promise<void> {
    const removeAdminUser = httpsCallable<AdminUserPayload, { ok: boolean }>(
      functions,
      'removeAdminUser',
    );

    await this.withTimeout(
      removeAdminUser({ email }),
      'Quitar administrador esta tardando mas de lo esperado. Revisa si el cambio aparece e intenta de nuevo.',
    );
  }

  private withTimeout<T>(promise: Promise<T>, message: string): Promise<T> {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error(message)), this.callableTimeoutMs);
    });

    return Promise.race([promise, timeout]).finally(() => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    });
  }
}
