import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { Router } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import {
  CredentialRequest,
  CredentialRequestType,
  credentialRequestTypeLabels,
  statusLabels,
} from '../../../../core/models/credential-request.model';
import { CredentialRequestService } from '../../../../core/services/credential-request.service';

@Component({
  selector: 'app-student-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatButtonToggleModule,
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
  private router = inject(Router);

  readonly statusLabels = statusLabels;
  readonly requestTypeLabels = credentialRequestTypeLabels;
  readonly requestTypes: CredentialRequestType[] = ['FIRST_TIME', 'REPLACEMENT'];
  readonly careers = [
    'Lic. Administración de Empresas',
    'Lic. Administración de Empresas Turísticas',
    'Lic. en Contaduría Pública',
    'Lic. en Ing. en Sistemas Computacionales',
    'Lic. en Diseño Gráfico Digital',
    'Lic. en Comercio Internacional',
    'Lic. en Derecho',
    'Lic. en Criminología y Criminalística',
    'Lic. en Mercadotecnia',
    'Lic. en Pedagogía',
    'Lic. en Arquitectura',
    'Lic. en Enfermería',
    'Lic. en Nutrición',
    'Lic. en Psicología',
    'Maestría en Educación',
    'Maestría en Recursos Humanos',
    'Maestría en Juicios Orales',
    'Maestría en Administración de Hospitales',
    'Maestría en Administración de Negocios',
    'Doctorado en Educación',
    'Especialidad en Enfermería en Cuidados Intensivos',
    'Especialidad en Enfermería Quirúrgica',
  ];
  readonly cycles = [
    'Primer cuatrimestre',
    'Segundo cuatrimestre',
    'Tercer cuatrimestre',
    'Cuarto cuatrimestre',
    'Quinto cuatrimestre',
    'Sexto cuatrimestre',
    'Séptimo cuatrimestre',
    'Octavo cuatrimestre',
    'Noveno cuatrimestre',
    'Décimo cuatrimestre',
    'Onceavo cuatrimestre',
    'Doceavo cuatrimestre',
  ];

  loading = true;
  submitting = false;
  errorMessage = '';
  successMessage = '';
  photoFile: File | null = null;
  evidenceFile: File | null = null;
  requests: CredentialRequest[] = [];

  form = this.fb.nonNullable.group({
    requestType: ['FIRST_TIME' as CredentialRequestType, Validators.required],
    studentId: ['', [Validators.required, Validators.minLength(4)]],
    name: ['', [Validators.required, Validators.minLength(3)]],
    career: ['', Validators.required],
    cycle: ['Primer cuatrimestre', Validators.required],
    phone: ['', [Validators.required, Validators.minLength(10)]],
  });

  get selectedRequestType(): CredentialRequestType {
    return this.form.controls.requestType.value;
  }

  get isReplacement(): boolean {
    return this.selectedRequestType === 'REPLACEMENT';
  }

  get hasFirstTimeRequest(): boolean {
    return this.requests.some((request) => request.requestType !== 'REPLACEMENT');
  }

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

    this.form.controls.requestType.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((requestType) => {
        if (requestType === 'FIRST_TIME') {
          this.evidenceFile = null;
        }
      });

    this.requestService
      .watchRequestsByUser(user.uid)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (requests) => {
          this.requests = requests;
          if (this.hasFirstTimeRequest && this.selectedRequestType === 'FIRST_TIME') {
            this.form.controls.requestType.setValue('REPLACEMENT');
          }
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

    if (this.form.invalid || !this.photoFile || (this.isReplacement && !this.evidenceFile)) {
      this.form.markAllAsTouched();
      this.errorMessage = this.isReplacement
        ? 'Completa el formulario y adjunta foto y comprobante de pago.'
        : 'Completa el formulario y adjunta tu foto.';
      return;
    }

    this.submitting = true;
    this.errorMessage = '';
    this.successMessage = '';

    try {
      const formValue = this.form.getRawValue();

      await this.requestService.createRequest({
        uid: user.uid,
        email: user.email || '',
        ...formValue,
        photo: this.photoFile,
        evidence: this.isReplacement ? this.evidenceFile : null,
      });

      this.form.reset({
        requestType: formValue.requestType === 'FIRST_TIME' ? 'REPLACEMENT' : formValue.requestType,
        studentId: '',
        name: user.displayName || '',
        career: '',
        cycle: 'Primer cuatrimestre',
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

  async logout(): Promise<void> {
    await this.authService.logout();
    await this.router.navigate(['/login']);
  }

  private isAllowedFile(file: File, type: 'photo' | 'evidence'): boolean {
    const maxSize = 10 * 1024 * 1024;
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
          ? 'La foto no debe superar 10 MB.'
          : 'El comprobante no debe superar 10 MB.';
      return false;
    }

    this.errorMessage = '';
    return true;
  }
}
