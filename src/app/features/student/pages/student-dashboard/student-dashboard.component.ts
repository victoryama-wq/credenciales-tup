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
  CredentialApplicantType,
  CredentialRequest,
  CredentialRequestType,
  credentialApplicantTypeLabels,
  credentialRequestTypeLabels,
  statusLabels,
} from '../../../../core/models/credential-request.model';
import { CredentialRequestService } from '../../../../core/services/credential-request.service';
import {
  InstitutionalProfile,
  institutionalAcademicStatusLabels,
} from '../../../../core/models/institutional-profile.model';
import { InstitutionalProfileService } from '../../../../core/services/institutional-profile.service';

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
  private institutionalProfileService = inject(InstitutionalProfileService);
  private destroyRef = inject(DestroyRef);
  private router = inject(Router);

  readonly statusLabels = statusLabels;
  readonly applicantTypeLabels = credentialApplicantTypeLabels;
  readonly academicStatusLabels = institutionalAcademicStatusLabels;
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
  detectedApplicantType: CredentialApplicantType = 'STUDENT';
  institutionalProfile: InstitutionalProfile | null = null;

  form = this.fb.nonNullable.group({
    applicantType: ['STUDENT' as CredentialApplicantType, Validators.required],
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

  get selectedApplicantType(): CredentialApplicantType {
    return this.form.controls.applicantType.value;
  }

  get isStudentApplicant(): boolean {
    return this.selectedApplicantType === 'STUDENT';
  }

  get isTeacherApplicant(): boolean {
    return this.selectedApplicantType === 'TEACHER';
  }

  get isStaffApplicant(): boolean {
    return this.selectedApplicantType === 'STAFF';
  }

  get isReplacement(): boolean {
    return this.selectedRequestType === 'REPLACEMENT';
  }

  get hasFirstTimeRequest(): boolean {
    return this.requests.some((request) => request.requestType !== 'REPLACEMENT');
  }

  get hasInstitutionalProfile(): boolean {
    return !!this.institutionalProfile;
  }

  get canSubmitCredentialRequest(): boolean {
    return !this.institutionalProfile || this.institutionalProfile.academicStatus === 'ACTIVE';
  }

  async ngOnInit(): Promise<void> {
    const user = await this.authService.waitForCurrentUser();

    if (!user) {
      this.loading = false;
      this.errorMessage = 'No hay sesión activa.';
      return;
    }

    this.detectedApplicantType = this.detectApplicantType(user.email || '');
    this.form.patchValue({
      applicantType: this.detectedApplicantType,
      name: user.displayName || '',
    });

    this.form.controls.requestType.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((requestType) => {
        if (requestType === 'FIRST_TIME') {
          this.evidenceFile = null;
        }
      });

    this.form.controls.applicantType.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((applicantType) => {
        this.applyApplicantValidators(applicantType);
      });

    this.applyApplicantValidators(this.detectedApplicantType);

    if (user.email) {
      this.institutionalProfileService
        .watchProfileByEmail(user.email)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (profile) => {
            this.institutionalProfile = profile;

            if (profile) {
              this.applyInstitutionalProfile(profile);
            }
          },
          error: (error) => {
            this.errorMessage = error.message || 'No fue posible cargar tu perfil institucional.';
          },
        });
    }

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
      this.errorMessage = 'Inicia sesión para enviar tu solicitud.';
      return;
    }

    if (!this.canSubmitCredentialRequest) {
      const status = this.institutionalProfile?.academicStatus || 'WITHDRAWN';
      this.errorMessage = `Tu perfil institucional aparece como ${this.academicStatusLabels[status]}. Contacta a Control Escolar.`;
      return;
    }

    if (this.form.invalid || !this.photoFile || (this.isReplacement && !this.evidenceFile)) {
      this.form.markAllAsTouched();
      this.errorMessage = this.buildMissingDataMessage();
      return;
    }

    this.submitting = true;
    this.errorMessage = '';
    this.successMessage = '';

    try {
      const formValue = this.form.getRawValue();
      const applicantType = this.detectedApplicantType;
      const isStudent = applicantType === 'STUDENT';
      const isStaff = applicantType === 'STAFF';
      const generatedIdentifier = user.email?.split('@')[0] || user.uid;

      await this.requestService.createRequest({
        uid: user.uid,
        email: user.email || '',
        applicantType,
        requestType: formValue.requestType,
        studentId: isStudent ? formValue.studentId : generatedIdentifier,
        name: formValue.name,
        career: isStudent || isStaff ? formValue.career : 'Docente',
        cycle: isStudent ? formValue.cycle : 'No aplica',
        phone: isStudent ? formValue.phone : 'No aplica',
        photo: this.photoFile,
        evidence: this.isReplacement ? this.evidenceFile : null,
      });

      this.form.reset({
        applicantType,
        requestType: formValue.requestType === 'FIRST_TIME' ? 'REPLACEMENT' : formValue.requestType,
        studentId: '',
        name: user.displayName || '',
        career: applicantType === 'TEACHER' ? 'Docente' : '',
        cycle: applicantType === 'STUDENT' ? 'Primer cuatrimestre' : 'No aplica',
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

  applicantLabel(type: CredentialApplicantType | undefined): string {
    return this.applicantTypeLabels[type || 'STUDENT'];
  }

  identifierLabel(type: CredentialApplicantType | undefined = this.selectedApplicantType): string {
    if (type === 'TEACHER') {
      return 'No. empleado docente';
    }

    if (type === 'STAFF') {
      return 'No. empleado';
    }

    return 'Matrícula';
  }

  areaLabel(type: CredentialApplicantType | undefined = this.selectedApplicantType): string {
    if (type === 'TEACHER') {
      return 'Docente';
    }

    if (type === 'STAFF') {
      return 'Puesto';
    }

    return 'Programa académico';
  }

  displayCycle(request: CredentialRequest): string {
    return request.applicantType === 'STUDENT' || !request.applicantType
      ? ` - ${request.cycle}`
      : '';
  }

  private applyInstitutionalProfile(profile: InstitutionalProfile): void {
    this.detectedApplicantType = profile.applicantType;
    this.form.controls.applicantType.setValue(profile.applicantType, { emitEvent: false });
    this.applyApplicantValidators(profile.applicantType);

    this.form.patchValue(
      {
        name: profile.name,
        studentId: profile.studentId || '',
        career:
          profile.applicantType === 'STAFF'
            ? profile.position || profile.career || ''
            : profile.applicantType === 'TEACHER'
              ? 'Docente'
              : profile.career || '',
        cycle: profile.applicantType === 'STUDENT' ? profile.currentTerm || '' : 'No aplica',
      },
      { emitEvent: false }
    );

    this.form.controls.name.disable({ emitEvent: false });
    this.form.controls.studentId.disable({ emitEvent: false });
    this.form.controls.career.disable({ emitEvent: false });
    this.form.controls.cycle.disable({ emitEvent: false });
  }

  private buildMissingDataMessage(): string {
    if (this.isReplacement && !this.evidenceFile) {
      return 'Completa el formulario y adjunta foto y comprobante de pago.';
    }

    if (this.isStaffApplicant) {
      return 'Captura nombre completo, puesto y foto.';
    }

    if (this.isTeacherApplicant) {
      return 'Captura nombre completo y foto.';
    }

    return 'Completa el formulario y adjunta tu foto.';
  }

  private detectApplicantType(email: string): CredentialApplicantType {
    const cleanEmail = email.trim().toLowerCase();
    const account = cleanEmail.split('@')[0] || '';

    if (/^tup-d\d{4,}$/.test(account)) {
      return 'TEACHER';
    }

    if (/^tup\d{4,}$/.test(account)) {
      return 'STUDENT';
    }

    return 'STAFF';
  }

  private applyApplicantValidators(applicantType: CredentialApplicantType): void {
    const isStudent = applicantType === 'STUDENT';
    const isStaff = applicantType === 'STAFF';

    this.form.controls.studentId.setValidators(
      isStudent ? [Validators.required, Validators.minLength(4)] : []
    );
    this.form.controls.career.setValidators(
      isStudent || isStaff ? [Validators.required, Validators.minLength(2)] : []
    );
    this.form.controls.cycle.setValidators(isStudent ? [Validators.required] : []);
    this.form.controls.phone.setValidators(
      isStudent ? [Validators.required, Validators.minLength(10)] : []
    );

    this.form.patchValue(
      {
        studentId: isStudent ? this.form.controls.studentId.value : '',
        career: isStudent || isStaff ? '' : 'Docente',
        cycle: isStudent ? 'Primer cuatrimestre' : 'No aplica',
        phone: isStudent ? this.form.controls.phone.value : '',
      },
      { emitEvent: false }
    );

    this.form.controls.studentId.updateValueAndValidity({ emitEvent: false });
    this.form.controls.career.updateValueAndValidity({ emitEvent: false });
    this.form.controls.cycle.updateValueAndValidity({ emitEvent: false });
    this.form.controls.phone.updateValueAndValidity({ emitEvent: false });
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
