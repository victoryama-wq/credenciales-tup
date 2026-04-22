import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { AuthService } from '../../../../core/services/auth.service';
import { CredentialRequest, statusLabels } from '../../../../core/models/credential-request.model';
import { CredentialRequestService } from '../../../../core/services/credential-request.service';

@Component({
  selector: 'app-student-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatDividerModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
  ],
  templateUrl: './student-dashboard.component.html',
})
export class StudentDashboardComponent implements OnInit {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private requestService = inject(CredentialRequestService);
  private destroyRef = inject(DestroyRef);

  readonly statusLabels = statusLabels;
  readonly careers = [
    'Administracion',
    'Contaduria',
    'Derecho',
    'Gastronomia',
    'Ingenieria en Sistemas',
    'Turismo',
  ];
  readonly cycles = ['2026-A', '2026-B', '2027-A'];

  loading = true;
  submitting = false;
  errorMessage = '';
  successMessage = '';
  photoFile: File | null = null;
  evidenceFile: File | null = null;
  requests: CredentialRequest[] = [];

  form = this.fb.nonNullable.group({
    studentId: ['', [Validators.required, Validators.minLength(4)]],
    name: ['', [Validators.required, Validators.minLength(3)]],
    career: ['', Validators.required],
    cycle: ['2026-A', Validators.required],
    phone: ['', [Validators.required, Validators.minLength(10)]],
  });

  async ngOnInit(): Promise<void> {
    const user = await this.authService.waitForCurrentUser();

    if (!user) {
      this.loading = false;
      this.errorMessage = 'No hay sesion activa.';
      return;
    }

    this.form.patchValue({
      name: user.displayName || '',
    });

    this.requestService
      .watchRequestsByUser(user.uid)
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

  setFile(event: Event, type: 'photo' | 'evidence'): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    if (!file) {
      return;
    }

    if (!this.isAllowedFile(file, type)) {
      input.value = '';
      return;
    }

    if (type === 'photo') {
      this.photoFile = file;
    } else {
      this.evidenceFile = file;
    }
  }

  async submit(): Promise<void> {
    const user = await this.authService.waitForCurrentUser();

    if (!user) {
      this.errorMessage = 'Inicia sesion para enviar tu solicitud.';
      return;
    }

    if (this.form.invalid || !this.photoFile || !this.evidenceFile) {
      this.form.markAllAsTouched();
      this.errorMessage = 'Completa el formulario y adjunta foto y evidencia.';
      return;
    }

    this.submitting = true;
    this.errorMessage = '';
    this.successMessage = '';

    try {
      await this.requestService.createRequest({
        uid: user.uid,
        email: user.email || '',
        ...this.form.getRawValue(),
        photo: this.photoFile,
        evidence: this.evidenceFile,
      });

      this.form.reset({
        studentId: '',
        name: user.displayName || '',
        career: '',
        cycle: '2026-A',
        phone: '',
      });
      this.photoFile = null;
      this.evidenceFile = null;
      this.successMessage = 'Solicitud enviada correctamente.';
    } catch (error) {
      this.errorMessage =
        error instanceof Error ? error.message : 'No fue posible enviar la solicitud.';
    } finally {
      this.submitting = false;
    }
  }

  private isAllowedFile(file: File, type: 'photo' | 'evidence'): boolean {
    const maxSize = type === 'photo' ? 2_000_000 : 5_000_000;
    const validPhoto = ['image/jpeg', 'image/png'];
    const validEvidence = ['image/jpeg', 'image/png', 'application/pdf'];
    const validTypes = type === 'photo' ? validPhoto : validEvidence;

    if (!validTypes.includes(file.type)) {
      this.errorMessage =
        type === 'photo'
          ? 'La foto debe ser JPG o PNG.'
          : 'La evidencia debe ser JPG, PNG o PDF.';
      return false;
    }

    if (file.size > maxSize) {
      this.errorMessage =
        type === 'photo'
          ? 'La foto no debe superar 2 MB.'
          : 'La evidencia no debe superar 5 MB.';
      return false;
    }

    this.errorMessage = '';
    return true;
  }
}
