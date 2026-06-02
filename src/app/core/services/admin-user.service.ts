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
  async listAdmins(): Promise<AdminUser[]> {
    const listAdminUsers = httpsCallable<void, AdminUsersResponse>(
      functions,
      'listAdminUsers'
    );
    const result = await listAdminUsers();

    return result.data.admins;
  }

  async addAdmin(email: string, name: string): Promise<AdminUser> {
    const addAdminUser = httpsCallable<AdminUserPayload, { admin: AdminUser }>(
      functions,
      'addAdminUser'
    );
    const result = await addAdminUser({ email, name });

    return result.data.admin;
  }

  async removeAdmin(email: string): Promise<void> {
    const removeAdminUser = httpsCallable<AdminUserPayload, { ok: boolean }>(
      functions,
      'removeAdminUser'
    );

    await removeAdminUser({ email });
  }
}

