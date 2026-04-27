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
import { toDataURL } from 'qrcode';
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
import {
  InstitutionalAcademicStatus,
  SaekoImportRow,
  institutionalAcademicStatusLabels,
} from '../../../../core/models/institutional-profile.model';
import { InstitutionalProfileService } from '../../../../core/services/institutional-profile.service';

type AdminModule = 'requests' | 'saeko';

interface SaekoPreviewRow extends SaekoImportRow {
  errors: string[];
}

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
  private institutionalProfileService = inject(InstitutionalProfileService);
  private destroyRef = inject(DestroyRef);
  private router = inject(Router);

  readonly statusLabels = statusLabels;
  readonly applicantTypeLabels = credentialApplicantTypeLabels;
  readonly academicStatusLabels = institutionalAcademicStatusLabels;
  readonly applicantTypes: CredentialApplicantType[] = ['STUDENT', 'TEACHER', 'STAFF'];
  readonly statuses = credentialRequestStatuses;
  readonly modules: { value: AdminModule; label: string }[] = [
    { value: 'requests', label: 'Solicitudes' },
    { value: 'saeko', label: 'Importacion Saeko' },
  ];

  activeModule: AdminModule = 'requests';
  loading = true;
  savingId = '';
  errorMessage = '';
  importErrorMessage = '';
  importSuccessMessage = '';
  statusFilter: CredentialRequestStatus | 'ALL' = 'ALL';
  applicantFilter: CredentialApplicantType | 'ALL' = 'ALL';
  printingRequestId = '';
  qrImages: Record<string, string> = {};
  requests: CredentialRequest[] = [];
  notes: Record<string, string> = {};
  saekoRows: SaekoPreviewRow[] = [];
  selectedSaekoFileName = '';
  importingProfiles = false;

  ngOnInit(): void {
    this.requestService
      .watchAllRequests()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (requests) => {
          this.requests = requests;
          void this.refreshQrImages(requests);
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

  get validSaekoRows(): SaekoImportRow[] {
    return this.saekoRows
      .filter((row) => row.errors.length === 0)
      .map(({ errors: _errors, ...row }) => row);
  }

  get invalidSaekoRows(): SaekoPreviewRow[] {
    return this.saekoRows.filter((row) => row.errors.length > 0);
  }

  get saekoSummary(): string {
    if (!this.saekoRows.length) {
      return 'Aun no hay archivo cargado.';
    }

    return `${this.validSaekoRows.length} validos, ${this.invalidSaekoRows.length} con observaciones.`;
  }

  setActiveModule(module: AdminModule): void {
    this.activeModule = module;
    this.errorMessage = '';
    this.importErrorMessage = '';
    this.importSuccessMessage = '';
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

  credentialRoleLabel(request: CredentialRequest): string {
    if (request.applicantType === 'TEACHER') {
      return 'DOCENTE';
    }

    if (request.applicantType === 'STAFF') {
      return 'COLABORADOR';
    }

    return 'ESTUDIANTE';
  }

  credentialPrimaryDetail(request: CredentialRequest): string {
    if (request.applicantType === 'TEACHER') {
      return 'Personal docente';
    }

    if (request.applicantType === 'STAFF') {
      return request.career;
    }

    return request.studentId;
  }

  credentialSecondaryDetail(request: CredentialRequest): string {
    if (request.applicantType === 'TEACHER') {
      return 'Tecnológico Universitario Playacar';
    }

    if (request.applicantType === 'STAFF') {
      return 'Personal administrativo';
    }

    return request.career;
  }

  verificationUrl(request: CredentialRequest): string {
    return request.verificationUrl || (request.qrToken ? `https://credencial-tup.web.app/verify/${request.qrToken}` : '');
  }

  printCredential(request: CredentialRequest): void {
    this.printingRequestId = request.id;
    setTimeout(() => {
      window.print();
      setTimeout(() => {
        this.printingRequestId = '';
      });
    });
  }

  async loadSaekoFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    this.importErrorMessage = '';
    this.importSuccessMessage = '';
    this.saekoRows = [];
    this.selectedSaekoFileName = file?.name || '';

    if (!file) {
      return;
    }

    if (!file.name.toLowerCase().endsWith('.csv')) {
      this.importErrorMessage = 'Por ahora el importador acepta archivos CSV.';
      input.value = '';
      return;
    }

    try {
      const text = await file.text();
      this.saekoRows = this.parseSaekoCsv(text);

      if (!this.saekoRows.length) {
        this.importErrorMessage = 'El CSV no contiene registros para importar.';
      }
    } catch (error) {
      this.importErrorMessage =
        error instanceof Error ? error.message : 'No fue posible leer el archivo.';
    }
  }

  async importSaekoProfiles(): Promise<void> {
    const rows = this.validSaekoRows;

    if (!rows.length) {
      this.importErrorMessage = 'No hay registros validos para importar.';
      return;
    }

    this.importingProfiles = true;
    this.importErrorMessage = '';
    this.importSuccessMessage = '';

    try {
      const result = await this.institutionalProfileService.importSaekoProfiles(rows);
      this.importSuccessMessage = `Importacion completa: ${result.imported} de ${result.total} registros aplicados.`;
    } catch (error) {
      this.importErrorMessage =
        error instanceof Error ? error.message : 'No fue posible importar los perfiles.';
    } finally {
      this.importingProfiles = false;
    }
  }

  async logout(): Promise<void> {
    await this.authService.logout();
    await this.router.navigate(['/login']);
  }

  private parseSaekoCsv(text: string): SaekoPreviewRow[] {
    const rows = this.parseCsv(text).filter((row) => row.some((cell) => cell.trim()));

    if (rows.length < 2) {
      return [];
    }

    const headers = rows[0].map((header) => this.normalizeHeader(header));

    return rows.slice(1).map((row, index) => {
      const rowNumber = index + 2;
      const value = (...names: string[]) => this.valueForHeader(row, headers, names);
      const email = value('correo', 'email', 'correo institucional').toLowerCase();
      const applicantType = this.normalizeApplicantType(
        value('tipo', 'tipo solicitante', 'solicitante'),
        email
      );
      const academicStatus = this.normalizeAcademicStatus(value('estatus', 'status', 'situacion'));
      const preview: SaekoPreviewRow = {
        rowNumber,
        email,
        applicantType,
        academicStatus,
        name: value('nombre', 'nombre completo', 'alumno'),
        studentId: value('matricula', 'matrícula', 'studentid', 'student id'),
        career: value('programa', 'programa academico', 'programa académico', 'carrera'),
        currentTerm: value('cuatrimestre', 'ciclo', 'periodo'),
        position: value('puesto', 'cargo'),
        errors: [],
      };

      this.validateSaekoPreviewRow(preview);

      return preview;
    });
  }

  private parseCsv(text: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let cell = '';
    let quoted = false;

    for (let index = 0; index < text.length; index++) {
      const char = text[index];
      const next = text[index + 1];

      if (char === '"' && quoted && next === '"') {
        cell += '"';
        index++;
        continue;
      }

      if (char === '"') {
        quoted = !quoted;
        continue;
      }

      if (char === ',' && !quoted) {
        row.push(cell.trim());
        cell = '';
        continue;
      }

      if ((char === '\n' || char === '\r') && !quoted) {
        if (char === '\r' && next === '\n') {
          index++;
        }

        row.push(cell.trim());
        rows.push(row);
        row = [];
        cell = '';
        continue;
      }

      cell += char;
    }

    row.push(cell.trim());
    rows.push(row);

    return rows;
  }

  private validateSaekoPreviewRow(row: SaekoPreviewRow): void {
    if (!row.email.endsWith('@tecplayacar.edu.mx')) {
      row.errors.push('Correo institucional invalido.');
    }

    if (!row.name) {
      row.errors.push('Falta nombre.');
    }

    if (!row.academicStatus) {
      row.errors.push('Estatus no reconocido.');
    }

    if (row.applicantType === 'STUDENT') {
      if (!row.studentId) {
        row.errors.push('Falta matricula.');
      }

      if (!row.career) {
        row.errors.push('Falta programa.');
      }

      if (!row.currentTerm) {
        row.errors.push('Falta cuatrimestre.');
      }
    }

    if (row.applicantType === 'STAFF' && !row.position && !row.career) {
      row.errors.push('Falta puesto.');
    }
  }

  private valueForHeader(row: string[], headers: string[], names: string[]): string {
    const index = headers.findIndex((header) => names.includes(header));

    if (index === -1) {
      return '';
    }

    return (row[index] || '').trim();
  }

  private normalizeHeader(header: string): string {
    return header
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ');
  }

  private normalizeApplicantType(value: string, email: string): CredentialApplicantType {
    const normalized = this.normalizeHeader(value);

    if (['docente', 'teacher', 'profesor'].includes(normalized)) {
      return 'TEACHER';
    }

    if (['colaborador', 'staff', 'administrativo', 'personal'].includes(normalized)) {
      return 'STAFF';
    }

    if (/^tup-d\d{4,}@tecplayacar\.edu\.mx$/.test(email)) {
      return 'TEACHER';
    }

    if (/^tup\d{4,}@tecplayacar\.edu\.mx$/.test(email)) {
      return 'STUDENT';
    }

    return 'STAFF';
  }

  private normalizeAcademicStatus(value: string): InstitutionalAcademicStatus {
    const normalized = this.normalizeHeader(value);

    if (['activo', 'activa', 'active', 'vigente'].includes(normalized)) {
      return 'ACTIVE';
    }

    if (['baja', 'inactivo', 'inactive', 'withdrawn', 'baja temporal'].includes(normalized)) {
      return 'WITHDRAWN';
    }

    if (['egresado', 'egresada', 'graduado', 'graduada', 'graduated'].includes(normalized)) {
      return 'GRADUATED';
    }

    if (['suspendido', 'suspendida', 'suspended'].includes(normalized)) {
      return 'SUSPENDED';
    }

    return '' as InstitutionalAcademicStatus;
  }

  private async refreshQrImages(requests: CredentialRequest[]): Promise<void> {
    for (const request of requests) {
      const url = this.verificationUrl(request);

      if (!request.qrToken || !url || this.qrImages[request.id]) {
        continue;
      }

      this.qrImages[request.id] = await toDataURL(url, {
        errorCorrectionLevel: 'M',
        margin: 1,
        scale: 5,
      });
    }
  }
}
