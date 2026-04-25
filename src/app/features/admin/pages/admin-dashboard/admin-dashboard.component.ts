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
import { Router } from '@angular/router';
import {
  CredentialApplicantType,
  CredentialRequest,
  CredentialRequestStatus,
  canTransitionCredentialRequestStatus,
  credentialApplicantTypeLabels,
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
  private router = inject(Router);

  readonly statusLabels = statusLabels;
  readonly applicantTypeLabels = credentialApplicantTypeLabels;
  readonly applicantTypes: CredentialApplicantType[] = ['STUDENT', 'TEACHER', 'STAFF'];
  readonly statuses = credentialRequestStatuses;

  loading = true;
  savingId = '';
  errorMessage = '';
  statusFilter: CredentialRequestStatus | 'ALL' = 'ALL';
  applicantFilter: CredentialApplicantType | 'ALL' = 'ALL';
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
    return this.requests.filter((request) => {
      const matchesStatus = this.statusFilter === 'ALL' || request.status === this.statusFilter;
      const matchesApplicant =
        this.applicantFilter === 'ALL' ||
        (request.applicantType || 'STUDENT') === this.applicantFilter;

      return matchesStatus && matchesApplicant;
    });
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
      this.errorMessage = 'No hay sesión administrativa activa.';
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
      await this.requestService.updateStatus(request.id, status, note);
      this.notes[request.id] = '';
    } catch (error) {
      this.errorMessage =
        error instanceof Error ? error.message : 'No fue posible actualizar la solicitud.';
    } finally {
      this.savingId = '';
    }
  }

  canMove(request: CredentialRequest, status: CredentialRequestStatus): boolean {
    return canTransitionCredentialRequestStatus(request.status, status);
  }

  applicantLabel(type: CredentialApplicantType | undefined): string {
    return this.applicantTypeLabels[type || 'STUDENT'];
  }

  identifierLabel(type: CredentialApplicantType | undefined): string {
    return type === 'STUDENT' || !type ? 'Matrícula' : 'Identificador';
  }

  showIdentifier(request: CredentialRequest): boolean {
    return !request.applicantType || request.applicantType === 'STUDENT';
  }

  detailLabel(request: CredentialRequest): string {
    if (request.applicantType === 'STAFF') {
      return 'Puesto';
    }

    if (request.applicantType === 'TEACHER') {
      return 'Perfil';
    }

    return 'Programa';
  }

  detailValue(request: CredentialRequest): string {
    if (request.applicantType === 'TEACHER') {
      return 'Docente';
    }

    return request.career;
  }

  displayCycle(request: CredentialRequest): string {
    return !request.applicantType || request.applicantType === 'STUDENT'
      ? ` - ${request.cycle}`
      : '';
  }

  async logout(): Promise<void> {
    await this.authService.logout();
    await this.router.navigate(['/login']);
  }
}
