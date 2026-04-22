import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

import { environment } from '../../../environments/environment';

const app = initializeApp(environment.firebase);

export const auth = getAuth(app);
export const db =
  environment.firestoreDatabaseId === '(default)'
    ? getFirestore(app)
    : getFirestore(app, environment.firestoreDatabaseId);
export const storage = getStorage(app);
export const functions = getFunctions(app, environment.functionsRegion);

if (!environment.production && environment.useEmulators) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099');
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  connectStorageEmulator(storage, '127.0.0.1', 9199);
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
}
