import { Injectable } from '@angular/core';
import { auth, db, storage, functions } from './firebase.client';

@Injectable({
  providedIn: 'root',
})
export class FirebaseHealthService {
  getStatus() {
    return {
      authReady: !!auth,
      firestoreReady: !!db,
      storageReady: !!storage,
      functionsReady: !!functions,
    };
  }
}