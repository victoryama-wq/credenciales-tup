import { Injectable } from '@angular/core';
import {
  GoogleAuthProvider,
  User,
  UserCredential,
  getIdToken,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { auth, functions } from '../firebase/firebase.client';
import {
  isInstitutionalEmail,
  normalizeEmailAddress,
} from '../auth/institutional-email.util';
import { UserRole } from '../models/user-role.model';

interface SyncUserSessionResult {
  role: UserRole;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly syncUserSessionCallable = httpsCallable<void, SyncUserSessionResult>(
    functions,
    'syncUserSession'
  );

  async login(email: string, password: string): Promise<UserCredential> {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);

    await this.ensureInstitutionalSession(userCredential.user);

    return userCredential;
  }

  async loginWithGoogle(): Promise<UserCredential> {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({
      hd: 'tecplayacar.edu.mx',
      prompt: 'select_account',
    });

    const userCredential = await signInWithPopup(auth, provider);

    await this.ensureInstitutionalSession(userCredential.user);

    return userCredential;
  }

  logout(): Promise<void> {
    return signOut(auth);
  }

  get currentUser() {
    return auth.currentUser;
  }

  waitForCurrentUser(): Promise<User | null> {
    if (auth.currentUser) {
      return Promise.resolve(auth.currentUser);
    }

    return new Promise((resolve) => {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        unsubscribe();
        resolve(user);
      });
    });
  }

  async getUserRole(user: User): Promise<UserRole> {
    return this.syncUserSession(user);
  }

  private async ensureInstitutionalSession(user: User): Promise<UserRole> {
    if (!isInstitutionalEmail(user.email)) {
      await signOut(auth);
      throw new Error('Usa tu cuenta institucional @tecplayacar.edu.mx.');
    }

    return this.syncUserSession(user);
  }

  private async syncUserSession(user: User): Promise<UserRole> {
    if (!isInstitutionalEmail(user.email)) {
      await signOut(auth);
      throw new Error('Solo se permite acceso con correo institucional.');
    }

    const response = await this.syncUserSessionCallable();
    await getIdToken(user, true);

    return response.data.role;
  }

  formatAuthError(error: unknown): string {
    const code = this.extractFirebaseErrorCode(error);

    switch (code) {
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return 'El correo o la contrasena no coinciden.';
      case 'auth/popup-closed-by-user':
        return 'Se cerro la ventana de Google antes de completar el acceso.';
      case 'auth/popup-blocked':
        return 'El navegador bloqueo la ventana emergente de Google.';
      case 'auth/account-exists-with-different-credential':
        return 'Ese correo ya existe con otro metodo de acceso.';
      case 'functions/permission-denied':
        return 'Solo se permite acceso con cuentas @tecplayacar.edu.mx.';
      default:
        if (error instanceof Error && error.message) {
          return error.message;
        }

        return 'No fue posible iniciar sesion.';
    }
  }

  private extractFirebaseErrorCode(error: unknown): string {
    if (typeof error !== 'object' || error === null) {
      return '';
    }

    const maybeCode = (error as { code?: unknown }).code;

    return typeof maybeCode === 'string' ? normalizeEmailAddress(maybeCode) : '';
  }
}
