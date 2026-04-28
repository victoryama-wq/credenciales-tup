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

type AdminModule = 'requests' | 'saeko' | 'templates';
type CredentialTemplateSide = 'front' | 'back';
type CredentialTemplateKey = 'admin' | 'docente' | 'estudiante';
type CredentialTemplateFieldKey = 'photo' | 'name' | 'matricula' | 'nivel' | 'programa' | 'qr';

interface CredentialTemplateFieldLayout {
  x: number;
  y: number;
  w: number;
  h: number;
}

type CredentialTemplateLayouts = Record<
  CredentialTemplateKey,
  Record<CredentialTemplateFieldKey, CredentialTemplateFieldLayout>
>;

interface CredentialTemplateEditorField {
  key: CredentialTemplateFieldKey;
  label: string;
  side: CredentialTemplateSide;
}

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
  private readonly templateLayoutStorageKey = 'tupCredentialTemplateLayoutsV1';

  readonly statusLabels = statusLabels;
  readonly applicantTypeLabels = credentialApplicantTypeLabels;
  readonly academicStatusLabels = institutionalAcademicStatusLabels;
  readonly applicantTypes: CredentialApplicantType[] = ['STUDENT', 'TEACHER', 'STAFF'];
  readonly templateEditorFields: CredentialTemplateEditorField[] = [
    { key: 'photo', label: 'Foto', side: 'front' },
    { key: 'name', label: 'Nombre', side: 'front' },
    { key: 'matricula', label: 'Matricula', side: 'front' },
    { key: 'nivel', label: 'Nivel', side: 'front' },
    { key: 'programa', label: 'Programa / puesto', side: 'front' },
    { key: 'qr', label: 'QR', side: 'back' },
  ];
  readonly defaultTemplateLayouts: CredentialTemplateLayouts = {
    estudiante: {
      photo: { x: 27, y: 18, w: 46.8, h: 34.8 },
      name: { x: 15, y: 58.3, w: 75, h: 6 },
      matricula: { x: 44.5, y: 78, w: 45, h: 3.6 },
      nivel: { x: 44.5, y: 84.3, w: 45, h: 3.6 },
      programa: { x: 44.5, y: 90.7, w: 45, h: 3.6 },
      qr: { x: 31.7, y: 60.1, w: 36.5, h: 36.5 },
    },
    docente: {
      photo: { x: 27, y: 18, w: 46.8, h: 34.8 },
      name: { x: 15, y: 58.3, w: 75, h: 6 },
      matricula: { x: 44.5, y: 78, w: 45, h: 3.6 },
      nivel: { x: 44.5, y: 84.3, w: 45, h: 3.6 },
      programa: { x: 44.5, y: 90.7, w: 45, h: 3.6 },
      qr: { x: 31.7, y: 60.1, w: 36.5, h: 36.5 },
    },
    admin: {
      photo: { x: 29.8, y: 18.8, w: 43.8, h: 34.2 },
      name: { x: 15, y: 58.3, w: 75, h: 6 },
      matricula: { x: 44.5, y: 78, w: 45, h: 3.6 },
      nivel: { x: 44.5, y: 84.3, w: 45, h: 3.6 },
      programa: { x: 44.5, y: 90.7, w: 45, h: 3.6 },
      qr: { x: 31.7, y: 60.1, w: 36.5, h: 36.5 },
    },
  };
  readonly statuses = credentialRequestStatuses;
  readonly modules: { value: AdminModule; label: string; eyebrow: string; description: string }[] = [
    {
      value: 'requests',
      label: 'Solicitudes',
      eyebrow: 'Operacion',
      description: 'Revision, estatus e impresion de credenciales.',
    },
    {
      value: 'saeko',
      label: 'Importacion Saeko',
      eyebrow: 'Control Escolar',
      description: 'Estatus, programa y cuatrimestre real.',
    },
    {
      value: 'templates',
      label: 'Diseño credencial',
      eyebrow: 'Motor de credencial',
      description: 'Ajuste visual de foto, datos y QR.',
    },
  ];

  activeModule: AdminModule = 'requests';
  sidebarVisible = false;
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
  selectedTemplateApplicant: CredentialApplicantType = 'STUDENT';
  selectedTemplateSide: CredentialTemplateSide = 'front';
  selectedTemplateField: CredentialTemplateFieldKey = 'photo';
  templateLayouts: CredentialTemplateLayouts = this.loadTemplateLayouts();

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

  selectModule(module: AdminModule): void {
    this.setActiveModule(module);
    this.sidebarVisible = false;
  }

  activeModuleLabel(): string {
    return this.modules.find((module) => module.value === this.activeModule)?.label || 'Menu';
  }

  activeModuleEyebrow(): string {
    return this.modules.find((module) => module.value === this.activeModule)?.eyebrow || 'Operacion';
  }

  toggleSidebar(): void {
    this.sidebarVisible = !this.sidebarVisible;
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

  credentialTemplateBackground(request: CredentialRequest, side: CredentialTemplateSide): string {
    return `url("/credential-templates/${this.credentialTemplateKey(request)}-${side}.png")`;
  }

  credentialTemplateElementStyle(
    request: CredentialRequest,
    field: CredentialTemplateFieldKey
  ): Record<string, string> {
    return this.templateFieldStyle(this.credentialTemplateKey(request), field);
  }

  credentialTemplateMatricula(request: CredentialRequest): string {
    return request.studentId || '';
  }

  credentialTemplateNivel(request: CredentialRequest): string {
    if (request.applicantType === 'TEACHER') {
      return 'Docente';
    }

    if (request.applicantType === 'STAFF') {
      return 'Administrativo';
    }

    return request.cycle || '';
  }

  credentialTemplatePrograma(request: CredentialRequest): string {
    if (request.applicantType === 'TEACHER') {
      return '';
    }

    return request.career || '';
  }

  selectedTemplateKey(): CredentialTemplateKey {
    return this.credentialTemplateKeyFromApplicant(this.selectedTemplateApplicant);
  }

  selectedTemplateBackground(): string {
    return `url("/credential-templates/${this.selectedTemplateKey()}-${this.selectedTemplateSide}.png")`;
  }

  visibleTemplateEditorFields(): CredentialTemplateEditorField[] {
    return this.templateEditorFields.filter((field) => {
      const matchesSide = field.side === this.selectedTemplateSide;
      const matchesApplicant =
        this.selectedTemplateApplicant !== 'TEACHER' || field.key !== 'programa';

      return matchesSide && matchesApplicant;
    });
  }

  templateEditorFieldStyle(field: CredentialTemplateFieldKey): Record<string, string> {
    return this.templateFieldStyle(this.selectedTemplateKey(), field);
  }

  templateEditorValue(field: CredentialTemplateFieldKey): string {
    if (field === 'name') {
      return this.templateSampleRequest()?.name || 'NOMBRE APELLIDO';
    }

    if (field === 'matricula') {
      return this.templateSampleRequest()?.studentId || this.templateSampleMatricula();
    }

    if (field === 'nivel') {
      return this.templateSampleNivel();
    }

    if (field === 'programa') {
      return this.templateSampleRequest()?.career || 'PROGRAMA O PUESTO';
    }

    return '';
  }

  templateEditorPhotoUrl(): string {
    return this.templateSampleRequest()?.photoUrl || '/logo-tup.png';
  }

  templateEditorQrUrl(): string {
    const sample = this.templateSampleRequest();

    return sample ? this.qrImages[sample.id] || '' : '';
  }

  templateEditorLayout(field: CredentialTemplateFieldKey): CredentialTemplateFieldLayout {
    return this.templateLayouts[this.selectedTemplateKey()][field];
  }

  updateTemplateFieldMetric(
    field: CredentialTemplateFieldKey,
    metric: keyof CredentialTemplateFieldLayout,
    event: Event
  ): void {
    const input = event.target as HTMLInputElement;
    const value = Number(input.value);

    if (Number.isNaN(value)) {
      return;
    }

    const layout = this.templateLayouts[this.selectedTemplateKey()][field];
    const max = metric === 'x' ? 100 - layout.w : metric === 'y' ? 100 - layout.h : 100;
    layout[metric] = this.clamp(value, 0, max);
    layout.x = this.clamp(layout.x, 0, 100 - layout.w);
    layout.y = this.clamp(layout.y, 0, 100 - layout.h);
    this.saveTemplateLayouts();
  }

  startTemplateDrag(event: PointerEvent, field: CredentialTemplateFieldKey): void {
    const target = event.currentTarget as HTMLElement;
    const card = target.closest<HTMLElement>('.template-designer-card');

    if (!card) {
      return;
    }

    event.preventDefault();
    this.selectedTemplateField = field;

    const rect = card.getBoundingClientRect();
    const layout = this.templateLayouts[this.selectedTemplateKey()][field];
    const startX = event.clientX;
    const startY = event.clientY;
    const originalX = layout.x;
    const originalY = layout.y;

    const move = (moveEvent: PointerEvent) => {
      const nextX = originalX + ((moveEvent.clientX - startX) / rect.width) * 100;
      const nextY = originalY + ((moveEvent.clientY - startY) / rect.height) * 100;

      layout.x = this.clamp(nextX, 0, 100 - layout.w);
      layout.y = this.clamp(nextY, 0, 100 - layout.h);
    };
    const up = () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      this.saveTemplateLayouts();
    };

    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
  }

  resetSelectedTemplateLayout(): void {
    const key = this.selectedTemplateKey();
    this.templateLayouts[key] = this.cloneLayoutGroup(this.defaultTemplateLayouts[key]);
    this.saveTemplateLayouts();
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

  private credentialTemplateKey(request: CredentialRequest): CredentialTemplateKey {
    if (request.applicantType === 'TEACHER') {
      return 'docente';
    }

    if (request.applicantType === 'STAFF') {
      return 'admin';
    }

    return 'estudiante';
  }

  private credentialTemplateKeyFromApplicant(
    applicantType: CredentialApplicantType
  ): CredentialTemplateKey {
    if (applicantType === 'TEACHER') {
      return 'docente';
    }

    if (applicantType === 'STAFF') {
      return 'admin';
    }

    return 'estudiante';
  }

  private templateFieldStyle(
    templateKey: CredentialTemplateKey,
    field: CredentialTemplateFieldKey
  ): Record<string, string> {
    const layout = this.templateLayouts[templateKey][field];

    return {
      height: `${layout.h}%`,
      left: `${layout.x}%`,
      top: `${layout.y}%`,
      width: `${layout.w}%`,
    };
  }

  private templateSampleRequest(): CredentialRequest | undefined {
    return this.requests.find(
      (request) => (request.applicantType || 'STUDENT') === this.selectedTemplateApplicant
    );
  }

  private templateSampleMatricula(): string {
    if (this.selectedTemplateApplicant === 'TEACHER') {
      return 'TUP-D1234';
    }

    if (this.selectedTemplateApplicant === 'STAFF') {
      return 'ADM-0001';
    }

    return 'TUP2104';
  }

  private templateSampleNivel(): string {
    if (this.selectedTemplateApplicant === 'TEACHER') {
      return 'DOCENTE';
    }

    if (this.selectedTemplateApplicant === 'STAFF') {
      return 'ADMINISTRATIVO';
    }

    return 'PRIMER CUATRIMESTRE';
  }

  private loadTemplateLayouts(): CredentialTemplateLayouts {
    const defaults = this.cloneTemplateLayouts(this.defaultTemplateLayouts);

    try {
      const raw = localStorage.getItem(this.templateLayoutStorageKey);

      if (!raw) {
        return defaults;
      }

      const stored = JSON.parse(raw) as Partial<CredentialTemplateLayouts>;

      for (const key of Object.keys(defaults) as CredentialTemplateKey[]) {
        defaults[key] = {
          ...defaults[key],
          ...(stored[key] || {}),
        };
      }

      return defaults;
    } catch {
      return defaults;
    }
  }

  private saveTemplateLayouts(): void {
    try {
      localStorage.setItem(this.templateLayoutStorageKey, JSON.stringify(this.templateLayouts));
    } catch {
      // La calibracion visual sigue funcionando aunque el navegador no permita guardarla.
    }
  }

  private cloneTemplateLayouts(layouts: CredentialTemplateLayouts): CredentialTemplateLayouts {
    return {
      estudiante: this.cloneLayoutGroup(layouts.estudiante),
      docente: this.cloneLayoutGroup(layouts.docente),
      admin: this.cloneLayoutGroup(layouts.admin),
    };
  }

  private cloneLayoutGroup(
    group: Record<CredentialTemplateFieldKey, CredentialTemplateFieldLayout>
  ): Record<CredentialTemplateFieldKey, CredentialTemplateFieldLayout> {
    return {
      photo: { ...group.photo },
      name: { ...group.name },
      matricula: { ...group.matricula },
      nivel: { ...group.nivel },
      programa: { ...group.programa },
      qr: { ...group.qr },
    };
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
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
