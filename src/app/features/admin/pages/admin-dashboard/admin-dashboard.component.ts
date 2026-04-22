import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import {
  CredentialRequest,
  CredentialRequestStatus,
  credentialRequestStatuses,
  statusLabels,
} from '../../../../core/models/credential-request.model';
import { AuthService } from '../../../../core/services/auth.service';
import { CredentialRequestService } from '../../../../core/services/credential-request.service';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatCardModule,
    MatDividerModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
  ],
  templateUrl: './admin-dashboard.component.html',
})
export class AdminDashboardComponent implements OnInit {
  private authService = inject(AuthService);
  private requestService = inject(CredentialRequestService);
  private destroyRef = inject(DestroyRef);

  readonly statusLabels = statusLabels;
  readonly statuses = credentialRequestStatuses;

  loading = true;
  savingId = '';
  errorMessage = '';
  statusFilter: CredentialRequestStatus | 'ALL' = 'ALL';
  requests: CredentialRequest[] = [];
  notes: Record<string, string> = {};

  ngOnInit(): void {
    this.requestService
      .watchAllRequests()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (requests) => {
          this.requests = requests;
          this.loading = false;
        },
        error: (error) => {
          this.errorMessage = error.message || 'No fue posible cargar solicitudes.';
          this.loading = false;
        },
      });
  }

  get filteredRequests(): CredentialRequest[] {
    if (this.statusFilter === 'ALL') {
      return this.requests;
    }

    return this.requests.filter((request) => request.status === this.statusFilter);
  }

  countByStatus(status: CredentialRequestStatus): number {
    return this.requests.filter((request) => request.status === status).length;
  }

  updateNote(requestId: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    this.notes[requestId] = input.value;
  }

  async move(request: CredentialRequest, status: CredentialRequestStatus): Promise<void> {
    const user = await this.authService.waitForCurrentUser();

    if (!user) {
      this.errorMessage = 'No hay sesion administrativa activa.';
      return;
    }

    const note = this.notes[request.id]?.trim();

    if (status === 'REJECTED' && !note) {
      this.errorMessage = 'Escribe el motivo antes de rechazar.';
      return;
    }

    this.savingId = request.id;
    this.errorMessage = '';

    try {
      await this.requestService.updateStatus(request.id, status, user.uid, note);
      this.notes[request.id] = '';
    } catch (error) {
      this.errorMessage =
        error instanceof Error ? error.message : 'No fue posible actualizar la solicitud.';
    } finally {
      this.savingId = '';
    }
  }

  canMove(request: CredentialRequest, status: CredentialRequestStatus): boolean {
    const allowed: Record<CredentialRequestStatus, CredentialRequestStatus[]> = {
      SUBMITTED: ['UNDER_REVIEW', 'REJECTED'],
      UNDER_REVIEW: ['APPROVED_FOR_PRINT', 'REJECTED'],
      REJECTED: ['UNDER_REVIEW'],
      APPROVED_FOR_PRINT: ['PRINTED'],
      PRINTED: ['READY_FOR_PICKUP'],
      READY_FOR_PICKUP: ['DELIVERED'],
      DELIVERED: [],
    };

    return allowed[request.status].includes(status);
  }
}
