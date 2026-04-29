import { Injectable, NgZone, inject } from '@angular/core';
import {
  DocumentData,
  QueryDocumentSnapshot,
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore';
import { Observable } from 'rxjs';
import { db } from '../firebase/firebase.client';
import { AuditLog } from '../models/audit-log.model';

@Injectable({
  providedIn: 'root',
})
export class AuditLogService {
  private readonly zone = inject(NgZone);
  private readonly collectionRef = collection(db, 'audit_logs');

  watchRecentLogs(maxLogs = 250): Observable<AuditLog[]> {
    const logsQuery = query(
      this.collectionRef,
      orderBy('timestamp', 'desc'),
      limit(maxLogs)
    );

    return new Observable((subscriber) => {
      const unsubscribe = onSnapshot(
        logsQuery,
        (snapshot) => {
          const logs = snapshot.docs.map((item) => this.fromSnapshot(item));
          this.zone.run(() => subscriber.next(logs));
        },
        (error) => this.zone.run(() => subscriber.error(error))
      );

      return unsubscribe;
    });
  }

  private fromSnapshot(snapshot: QueryDocumentSnapshot<DocumentData>): AuditLog {
    return {
      id: snapshot.id,
      ...snapshot.data(),
    } as AuditLog;
  }
}
