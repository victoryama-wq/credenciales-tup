import { Injectable } from '@angular/core';
import {
  User,
  UserCredential,
  getIdTokenResult,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { auth } from '../firebase/firebase.client';
import { UserRole } from '../models/user-role.model';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  login(email: string, password: string): Promise<UserCredential> {
    return signInWithEmailAndPassword(auth, email, password);
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
    const token = await getIdTokenResult(user);
    const role = token.claims['role'];

    if (role === 'admin' || token.claims['admin'] === true) {
      return 'admin';
    }

    return 'student';
  }
}
