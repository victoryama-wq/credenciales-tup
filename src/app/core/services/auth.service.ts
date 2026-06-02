import { Injectable, NgZone, inject } from '@angular/core';
import { Router } from '@angular/router';
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

const inactivityTimeoutMs = 30 * 60 * 1000;
const activityThrottleMs = 15 * 1000;
const lastActivityStorageKey = 'tupCredentialLastActivityAt';
const activityEvents = [
  'click',
  'keydown',
  'pointerdown',
  'touchstart',
  'scroll',
] as const;

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly router = inject(Router);
  private readonly zone = inject(NgZone);
  private readonly syncUserSessionCallable = httpsCallable<void, SyncUserSessionResult>(
    functions,
    'syncUserSession'
  );
  private activityListenersReady = false;
  private inactivityTimer: number | null = null;
  private lastActivityWriteAt = 0;

  constructor() {
    this.initializeInactivityControl();
  }

  async login(email: string, password: string): Promise<UserCredential> {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);

    await this.ensureInstitutionalSession(userCredential.user);
    this.activateSession();

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
    this.activateSession();

    return userCredential;
  }

  async logout(): Promise<void> {
    this.clearSessionActivity();
    await signOut(auth);
  }

  get currentUser() {
    return auth.currentUser;
  }

  waitForCurrentUser(): Promise<User | null> {
    if (auth.currentUser) {
      return this.ensureActiveSession().then((active) => (active ? auth.currentUser : null));
    }

    return new Promise((resolve) => {
      const unsubscribe = onAuthStateChanged(auth, async (user) => {
        unsubscribe();

        if (!user) {
          resolve(null);
          return;
        }

        const active = await this.ensureActiveSession();
        resolve(active ? user : null);
      });
    });
  }

  async getUserRole(user: User): Promise<UserRole> {
    if (!(await this.ensureActiveSession())) {
      throw new Error('La sesión expiró por inactividad.');
    }

    return this.syncUserSession(user);
  }

  async ensureActiveSession(): Promise<boolean> {
    if (!auth.currentUser) {
      return false;
    }

    if (this.isInactiveSessionExpired()) {
      await this.expireSession();
      return false;
    }

    if (!this.readLastActivityAt()) {
      this.touchActivity(true);
    }

    this.ensureActivityListeners();
    this.scheduleInactivityCheck();

    return true;
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

  private initializeInactivityControl(): void {
    if (!this.isBrowser()) {
      return;
    }

    onAuthStateChanged(auth, (user) => {
      if (!user) {
        this.clearSessionActivity();
        return;
      }

      if (this.isInactiveSessionExpired()) {
        void this.expireSession();
        return;
      }

      if (!this.readLastActivityAt()) {
        this.touchActivity(true);
      }

      this.ensureActivityListeners();
      this.scheduleInactivityCheck();
    });
  }

  private activateSession(): void {
    this.touchActivity(true);
    this.ensureActivityListeners();
    this.scheduleInactivityCheck();
  }

  private ensureActivityListeners(): void {
    if (this.activityListenersReady || !this.isBrowser()) {
      return;
    }

    this.activityListenersReady = true;

    for (const eventName of activityEvents) {
      window.addEventListener(eventName, this.handleActivity, {
        passive: true,
      });
    }

    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    window.addEventListener('focus', this.handleActivity, { passive: true });
  }

  private handleActivity = (): void => {
    if (!auth.currentUser) {
      return;
    }

    if (this.isInactiveSessionExpired()) {
      void this.expireSession();
      return;
    }

    this.touchActivity();
    this.scheduleInactivityCheck();
  };

  private handleVisibilityChange = (): void => {
    if (!auth.currentUser || document.visibilityState !== 'visible') {
      return;
    }

    if (this.isInactiveSessionExpired()) {
      void this.expireSession();
      return;
    }

    this.scheduleInactivityCheck();
  };

  private touchActivity(force = false): void {
    if (!this.isBrowser()) {
      return;
    }

    const now = Date.now();

    if (!force && now - this.lastActivityWriteAt < activityThrottleMs) {
      return;
    }

    this.lastActivityWriteAt = now;

    try {
      localStorage.setItem(lastActivityStorageKey, String(now));
    } catch {
      // Si el navegador bloquea almacenamiento local, la sesion sigue viva
      // y el guard puede volver a validarla con Firebase.
    }
  }

  private scheduleInactivityCheck(): void {
    if (!this.isBrowser()) {
      return;
    }

    if (this.inactivityTimer) {
      window.clearTimeout(this.inactivityTimer);
    }

    const lastActivityAt = this.readLastActivityAt() || Date.now();
    const elapsed = Date.now() - lastActivityAt;
    const remaining = Math.max(inactivityTimeoutMs - elapsed, 1000);

    this.inactivityTimer = window.setTimeout(() => {
      if (this.isInactiveSessionExpired()) {
        void this.expireSession();
        return;
      }

      this.scheduleInactivityCheck();
    }, remaining);
  }

  private async expireSession(): Promise<void> {
    this.clearSessionActivity();
    await signOut(auth);

    this.zone.run(() => {
      void this.router.navigate(['/login'], {
        queryParams: { session: 'expired' },
        replaceUrl: true,
      });
    });
  }

  private clearSessionActivity(): void {
    if (!this.isBrowser()) {
      return;
    }

    try {
      localStorage.removeItem(lastActivityStorageKey);
    } catch {
      // No todos los navegadores permiten limpiar storage en modo restringido.
    }

    this.lastActivityWriteAt = 0;

    if (this.inactivityTimer) {
      window.clearTimeout(this.inactivityTimer);
      this.inactivityTimer = null;
    }
  }

  private isInactiveSessionExpired(): boolean {
    const lastActivityAt = this.readLastActivityAt();

    return Boolean(lastActivityAt && Date.now() - lastActivityAt > inactivityTimeoutMs);
  }

  private readLastActivityAt(): number | null {
    if (!this.isBrowser()) {
      return null;
    }

    let raw: string | null = null;

    try {
      raw = localStorage.getItem(lastActivityStorageKey);
    } catch {
      return null;
    }

    const value = raw ? Number(raw) : 0;

    return Number.isFinite(value) && value > 0 ? value : null;
  }

  private isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
  }

  formatAuthError(error: unknown): string {
    const code = this.extractFirebaseErrorCode(error);

    switch (code) {
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return 'El correo o la contraseña no coinciden.';
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

        return 'No fue posible iniciar sesión.';
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
