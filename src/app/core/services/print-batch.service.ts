import { Injectable, NgZone, inject } from '@angular/core';
import {
  DocumentData,
  QueryDocumentSnapshot,
  collection,
  onSnapshot,
  query,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { Observable } from 'rxjs';
import { db, functions } from '../firebase/firebase.client';
import { PrintBatch } from '../models/print-batch.model';

interface CreatePrintBatchPayload {
  requestIds: string[];
  note?: string;
}

interface CreatePrintBatchResponse {
  batchId: string;
}

interface MarkPrintBatchPrintedPayload {
  batchId: string;
  note?: string;
}

@Injectable({
  providedIn: 'root',
})
export class PrintBatchService {
  private readonly zone = inject(NgZone);
  private readonly collectionRef = collection(db, 'print_batches');

  watchBatches(): Observable<PrintBatch[]> {
    return new Observable((subscriber) => {
      const unsubscribe = onSnapshot(
        query(this.collectionRef),
        (snapshot) => {
          const batches = snapshot.docs
            .map((item) => this.fromSnapshot(item))
            .sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());

          this.zone.run(() => subscriber.next(batches));
        },
        (error) => this.zone.run(() => subscriber.error(error))
      );

      return unsubscribe;
    });
  }

  async createBatch(requestIds: string[], note?: string): Promise<string> {
    const createPrintBatch = httpsCallable<CreatePrintBatchPayload, CreatePrintBatchResponse>(
      functions,
      'createPrintBatch'
    );
    const result = await createPrintBatch({ requestIds, note });

    return result.data.batchId;
  }

  async markPrinted(batchId: string, note?: string): Promise<void> {
    const markPrintBatchPrinted = httpsCallable<MarkPrintBatchPrintedPayload, { ok: boolean }>(
      functions,
      'markPrintBatchPrinted'
    );

    await markPrintBatchPrinted({ batchId, note });
  }

  private fromSnapshot(snapshot: QueryDocumentSnapshot<DocumentData>): PrintBatch {
    return {
      id: snapshot.id,
      ...snapshot.data(),
    } as PrintBatch;
  }
}
