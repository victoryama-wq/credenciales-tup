import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
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
  CredentialTimelineEvent,
  canTransitionCredentialRequestStatus,
  credentialApplicantTypeLabels,
  credentialRequestStatuses,
  statusLabels,
} from '../../../../core/models/credential-request.model';
import {
  PrintBatch,
  printBatchStatusLabels,
} from '../../../../core/models/print-batch.model';
import {
  CredentialTemplateAsset,
  CredentialTemplateFieldKey,
  CredentialTemplateFieldLayout,
  CredentialTemplateKey,
  CredentialTemplateLayouts,
  CredentialTemplateSettings,
  CredentialTemplateSide,
} from '../../../../core/models/credential-template.model';
import { AuthService } from '../../../../core/services/auth.service';
import { CredentialRequestService } from '../../../../core/services/credential-request.service';
import { CredentialTemplateService } from '../../../../core/services/credential-template.service';
import { PrintBatchService } from '../../../../core/services/print-batch.service';
import {
  InstitutionalAcademicStatus,
  SaekoImportRow,
  institutionalAcademicStatusLabels,
} from '../../../../core/models/institutional-profile.model';
import { InstitutionalProfileService } from '../../../../core/services/institutional-profile.service';

type AdminModule = 'dashboard' | 'requests' | 'batches' | 'delivery' | 'saeko' | 'templates';

type CredentialTemplateNumericMetric = 'x' | 'y' | 'w' | 'h' | 'fontSize';

interface CredentialTemplateEditorField {
  key: CredentialTemplateFieldKey;
  label: string;
  side: CredentialTemplateSide;
}

interface SaekoPreviewRow extends SaekoImportRow {
  errors: string[];
}

interface DashboardBreakdownRow {
  label: string;
  count: number;
  percent: number;
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
  private credentialTemplateService = inject(CredentialTemplateService);
  private printBatchService = inject(PrintBatchService);
  private institutionalProfileService = inject(InstitutionalProfileService);
  private destroyRef = inject(DestroyRef);
  private changeDetectorRef = inject(ChangeDetectorRef);
  private router = inject(Router);
  private readonly templateLayoutStorageKey = 'tupCredentialTemplateLayoutsV2';

  readonly statusLabels = statusLabels;
  readonly printBatchStatusLabels = printBatchStatusLabels;
  readonly applicantTypeLabels = credentialApplicantTypeLabels;
  readonly academicStatusLabels = institutionalAcademicStatusLabels;
  readonly applicantTypes: CredentialApplicantType[] = ['STUDENT', 'TEACHER', 'STAFF'];
  readonly deliveryStatuses: CredentialRequestStatus[] = [
    'PRINTED',
    'READY_FOR_PICKUP',
    'DELIVERED',
  ];
  readonly dashboardActiveStatuses: CredentialRequestStatus[] = [
    'SUBMITTED',
    'UNDER_REVIEW',
    'APPROVED_FOR_PRINT',
    'PRINTED',
    'READY_FOR_PICKUP',
  ];
  readonly dashboardPrintedStatuses: CredentialRequestStatus[] = [
    'PRINTED',
    'READY_FOR_PICKUP',
    'DELIVERED',
  ];
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
      photo: { x: 32, y: 26, w: 36, h: 28 },
      name: { x: 12, y: 55.5, w: 76, h: 5.2, fontSize: 3.8, color: '#ffffff' },
      matricula: { x: 18, y: 66.2, w: 64, h: 4.8, fontSize: 3.2, color: '#0f1738' },
      nivel: { x: 18, y: 76.6, w: 64, h: 4.8, fontSize: 3.2, color: '#0f1738' },
      programa: { x: 18, y: 87, w: 64, h: 5, fontSize: 3, color: '#0f1738' },
      qr: { x: 24, y: 46, w: 52, h: 32 },
    },
    docente: {
      photo: { x: 33, y: 29, w: 35, h: 27 },
      name: { x: 18, y: 62.5, w: 66, h: 5.8, fontSize: 3.6, color: '#ffffff' },
      matricula: { x: 18, y: 72.8, w: 66, h: 5, fontSize: 3.2, color: '#0f1738' },
      nivel: { x: 18, y: 83, w: 66, h: 5, fontSize: 3.2, color: '#0f1738' },
      programa: { x: 18, y: 89, w: 66, h: 4, fontSize: 2.8, color: '#0f1738' },
      qr: { x: 24, y: 45, w: 52, h: 32 },
    },
    admin: {
      photo: { x: 33, y: 29, w: 35, h: 27 },
      name: { x: 18, y: 76, w: 64, h: 5.8, fontSize: 3.4, color: '#0f1738' },
      matricula: { x: 18, y: 83, w: 64, h: 4, fontSize: 2.8, color: '#0f1738' },
      nivel: { x: 18, y: 87, w: 64, h: 4, fontSize: 2.8, color: '#0f1738' },
      programa: { x: 18, y: 91, w: 64, h: 4, fontSize: 2.8, color: '#0f1738' },
      qr: { x: 24, y: 46, w: 52, h: 32 },
    },
  };
  readonly statuses = credentialRequestStatuses;
  readonly modules: { value: AdminModule; label: string; eyebrow: string; description: string }[] = [
    {
      value: 'dashboard',
      label: 'Dashboard',
      eyebrow: 'Resumen ejecutivo',
      description: 'Indicadores, avance y tiempos del flujo.',
    },
    {
      value: 'requests',
      label: 'Solicitudes',
      eyebrow: 'Operacion',
      description: 'Revision, estatus e impresion de credenciales.',
    },
    {
      value: 'batches',
      label: 'Lotes de impresion',
      eyebrow: 'Produccion',
      description: 'Agrupa, imprime y cierra credenciales listas.',
    },
    {
      value: 'delivery',
      label: 'Entrega de credenciales',
      eyebrow: 'Ventanilla',
      description: 'Control de credenciales listas y entregadas.',
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

  activeModule: AdminModule = 'dashboard';
  sidebarVisible = false;
  loading = true;
  savingId = '';
  errorMessage = '';
  importErrorMessage = '';
  importSuccessMessage = '';
  statusFilter: CredentialRequestStatus | 'ALL' = 'ALL';
  applicantFilter: CredentialApplicantType | 'ALL' = 'ALL';
  deliveryStatusFilter: CredentialRequestStatus | 'ALL' = 'ALL';
  deliveryApplicantFilter: CredentialApplicantType | 'ALL' = 'ALL';
  printingRequestId = '';
  printingBatchId = '';
  qrImages: Record<string, string> = {};
  requests: CredentialRequest[] = [];
  printBatches: PrintBatch[] = [];
  selectedBatchRequestIds = new Set<string>();
  creatingBatch = false;
  batchActionId = '';
  batchMessage = '';
  batchErrorMessage = '';
  notes: Record<string, string> = {};
  saekoRows: SaekoPreviewRow[] = [];
  selectedSaekoFileName = '';
  importingProfiles = false;
  selectedTemplateApplicant: CredentialApplicantType = 'STUDENT';
  selectedTemplateSide: CredentialTemplateSide = 'front';
  selectedTemplateField: CredentialTemplateFieldKey = 'photo';
  templateLayouts: CredentialTemplateLayouts = this.loadTemplateLayouts();
  templateSettings: CredentialTemplateSettings = {};
  templateUploadMessage = '';
  templateUploadErrorMessage = '';
  uploadingTemplateKey = '';

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

    this.printBatchService
      .watchBatches()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (batches) => {
          this.printBatches = batches;
        },
        error: (error) => {
          this.batchErrorMessage = error.message || 'No fue posible cargar lotes.';
        },
      });

    this.credentialTemplateService
      .watchSettings()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (settings) => {
          this.templateSettings = settings;
        },
        error: (error) => {
          this.templateUploadErrorMessage =
            error.message || 'No fue posible cargar las plantillas guardadas.';
        },
      });

    this.credentialTemplateService
      .watchLayouts()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (layouts) => {
          if (!this.hasStoredTemplateLayouts(layouts)) {
            if (this.hasLocalTemplateLayoutStorage()) {
              void this.credentialTemplateService.saveLayouts(this.templateLayouts).catch((error) => {
                this.templateUploadErrorMessage =
                  error instanceof Error
                    ? error.message
                    : 'No fue posible publicar la calibracion visual guardada.';
              });
            }

            return;
          }

          this.templateLayouts = this.mergeTemplateLayouts(layouts);
          this.persistTemplateLayoutsLocally();
        },
        error: (error) => {
          this.templateUploadErrorMessage =
            error.message || 'No fue posible cargar la calibracion visual guardada.';
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

  get batchCandidateRequests(): CredentialRequest[] {
    return this.requests.filter(
      (request) => request.status === 'APPROVED_FOR_PRINT' && !request.printBatchId
    );
  }

  get selectedBatchRequests(): CredentialRequest[] {
    return this.batchCandidateRequests.filter((request) =>
      this.selectedBatchRequestIds.has(request.id)
    );
  }

  get activePrintBatches(): PrintBatch[] {
    return this.printBatches.filter((batch) => batch.status !== 'PRINTED');
  }

  get completedPrintBatches(): PrintBatch[] {
    return this.printBatches.filter((batch) => batch.status === 'PRINTED');
  }

  get deliveryRequests(): CredentialRequest[] {
    return this.requests.filter((request) => {
      const matchesStatus =
        this.deliveryStatusFilter === 'ALL' || request.status === this.deliveryStatusFilter;
      const matchesApplicant =
        this.deliveryApplicantFilter === 'ALL' ||
        (request.applicantType || 'STUDENT') === this.deliveryApplicantFilter;

      return this.deliveryStatuses.includes(request.status) && matchesStatus && matchesApplicant;
    });
  }

  get dashboardTotalRequests(): number {
    return this.requests.length;
  }

  get dashboardActiveRequests(): number {
    return this.requests.filter((request) =>
      this.dashboardActiveStatuses.includes(request.status)
    ).length;
  }

  get dashboardDeliveredRequests(): number {
    return this.countByStatus('DELIVERED');
  }

  get dashboardRejectedRequests(): number {
    return this.countByStatus('REJECTED');
  }

  get dashboardReadyForPickupRequests(): number {
    return this.countByStatus('READY_FOR_PICKUP');
  }

  get dashboardPendingPrintRequests(): number {
    return this.countByStatus('APPROVED_FOR_PRINT');
  }

  get dashboardPrintedRequests(): CredentialRequest[] {
    return this.requests.filter((request) =>
      this.dashboardPrintedStatuses.includes(request.status)
    );
  }

  get dashboardPrintedTotal(): number {
    return this.dashboardPrintedRequests.length;
  }

  get dashboardPrintedStudentRequests(): CredentialRequest[] {
    return this.dashboardPrintedRequests.filter(
      (request) => !request.applicantType || request.applicantType === 'STUDENT'
    );
  }

  get dashboardDeliveryRate(): number {
    return this.dashboardPercent(this.dashboardDeliveredRequests);
  }

  get dashboardRejectionRate(): number {
    return this.dashboardPercent(this.dashboardRejectedRequests);
  }

  get dashboardStatusBreakdown(): DashboardBreakdownRow[] {
    return this.statuses.map((status) => ({
      label: this.statusLabels[status],
      count: this.countByStatus(status),
      percent: this.dashboardPercent(this.countByStatus(status)),
    }));
  }

  get dashboardApplicantBreakdown(): DashboardBreakdownRow[] {
    return this.applicantTypes.map((type) => {
      const count = this.requests.filter(
        (request) => (request.applicantType || 'STUDENT') === type
      ).length;

      return {
        label: this.applicantTypeLabels[type],
        count,
        percent: this.dashboardPercent(count),
      };
    });
  }

  get dashboardPrintedByCredentialType(): DashboardBreakdownRow[] {
    return this.applicantTypes.map((type) => {
      const count = this.dashboardPrintedRequests.filter(
        (request) => (request.applicantType || 'STUDENT') === type
      ).length;

      return {
        label: this.dashboardCredentialTypeLabel(type),
        count,
        percent: this.dashboardPercent(count, this.dashboardPrintedTotal),
      };
    });
  }

  get dashboardPrintedByLevel(): DashboardBreakdownRow[] {
    return this.dashboardBuildBreakdown(
      this.dashboardPrintedStudentRequests,
      (request) => request.cycle || 'Sin cuatrimestre'
    );
  }

  get dashboardPrintedByCareer(): DashboardBreakdownRow[] {
    return this.dashboardBuildBreakdown(
      this.dashboardPrintedStudentRequests,
      (request) => request.career || 'Sin programa'
    );
  }

  get dashboardRecentDeliveries(): CredentialRequest[] {
    return this.requests
      .filter((request) => request.status === 'DELIVERED')
      .slice()
      .sort(
        (left, right) =>
          (this.dashboardDeliveredMillis(right) || 0) -
          (this.dashboardDeliveredMillis(left) || 0)
      )
      .slice(0, 5);
  }

  get dashboardRequestToApprovalAverage(): string {
    return this.averageDurationLabel(
      this.requests.map((request) => ({
        start: this.timestampMillis(request.submittedAt),
        end: this.statusTimestampMillis(request, 'APPROVED_FOR_PRINT'),
      }))
    );
  }

  get dashboardApprovalToPrintAverage(): string {
    return this.averageDurationLabel(
      this.requests.map((request) => ({
        start: this.statusTimestampMillis(request, 'APPROVED_FOR_PRINT'),
        end: this.timestampMillis(request.printedAt) || this.statusTimestampMillis(request, 'PRINTED'),
      }))
    );
  }

  get dashboardReadyToDeliveredAverage(): string {
    return this.averageDurationLabel(
      this.requests.map((request) => ({
        start: this.timestampMillis(request.readyForPickupAt) || this.statusTimestampMillis(request, 'READY_FOR_PICKUP'),
        end: this.dashboardDeliveredMillis(request),
      }))
    );
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

  deliveryCountByStatus(status: CredentialRequestStatus): number {
    return this.requests.filter((request) => request.status === status).length;
  }

  dashboardPercent(count: number, total = this.dashboardTotalRequests): number {
    return total ? Math.round((count / total) * 100) : 0;
  }

  dashboardDeliveredDate(request: CredentialRequest): Date | null {
    const millis = this.dashboardDeliveredMillis(request);

    return millis ? new Date(millis) : null;
  }

  dashboardCredentialTypeLabel(type: CredentialApplicantType): string {
    if (type === 'TEACHER') {
      return 'Docente';
    }

    if (type === 'STAFF') {
      return 'Administrativo';
    }

    return 'Estudiante';
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

  timelineDate(event: CredentialTimelineEvent): Date {
    return event.timestamp.toDate();
  }

  private timestampMillis(value?: { toMillis: () => number } | null): number | null {
    return value ? value.toMillis() : null;
  }

  private statusTimestampMillis(
    request: CredentialRequest,
    status: CredentialRequestStatus
  ): number | null {
    return (
      request.timeline.find((event) => event.status === status)?.timestamp.toMillis() || null
    );
  }

  private dashboardDeliveredMillis(request: CredentialRequest): number | null {
    return (
      this.timestampMillis(request.deliveredAt) ||
      this.statusTimestampMillis(request, 'DELIVERED')
    );
  }

  private averageDurationLabel(ranges: { start: number | null; end: number | null }[]): string {
    const durations = ranges
      .filter((range): range is { start: number; end: number } =>
        Boolean(range.start && range.end && range.end >= range.start)
      )
      .map((range) => range.end - range.start);

    if (!durations.length) {
      return 'Sin datos';
    }

    const averageMs = durations.reduce((total, duration) => total + duration, 0) / durations.length;
    const minutes = Math.round(averageMs / 60000);

    if (minutes < 60) {
      return `${Math.max(minutes, 1)} min`;
    }

    const hours = averageMs / 3600000;

    if (hours < 48) {
      return `${hours < 10 ? hours.toFixed(1) : Math.round(hours)} h`;
    }

    const days = hours / 24;

    return `${days < 10 ? days.toFixed(1) : Math.round(days)} dias`;
  }

  private dashboardBuildBreakdown(
    requests: CredentialRequest[],
    labelForRequest: (request: CredentialRequest) => string
  ): DashboardBreakdownRow[] {
    const counts = new Map<string, number>();

    for (const request of requests) {
      const label = labelForRequest(request).trim() || 'Sin clasificar';
      counts.set(label, (counts.get(label) || 0) + 1);
    }

    return Array.from(counts.entries())
      .map(([label, count]) => ({
        label,
        count,
        percent: this.dashboardPercent(count, requests.length),
      }))
      .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
  }

  requestSelectedForBatch(requestId: string): boolean {
    return this.selectedBatchRequestIds.has(requestId);
  }

  toggleBatchSelection(requestId: string, event: Event): void {
    const input = event.target as HTMLInputElement;

    if (input.checked) {
      this.selectedBatchRequestIds.add(requestId);
    } else {
      this.selectedBatchRequestIds.delete(requestId);
    }
  }

  selectAllBatchCandidates(): void {
    this.selectedBatchRequestIds = new Set(
      this.batchCandidateRequests.map((request) => request.id)
    );
  }

  clearBatchSelection(): void {
    this.selectedBatchRequestIds.clear();
  }

  async createPrintBatch(): Promise<void> {
    const requestIds = this.selectedBatchRequests.map((request) => request.id);

    if (!requestIds.length) {
      this.batchErrorMessage = 'Selecciona al menos una solicitud aprobada.';
      return;
    }

    this.creatingBatch = true;
    this.batchErrorMessage = '';
    this.batchMessage = '';

    try {
      const batchId = await this.printBatchService.createBatch(requestIds);
      this.batchMessage = `Lote ${batchId} creado con ${requestIds.length} credenciales.`;
      this.selectedBatchRequestIds.clear();
    } catch (error) {
      this.batchErrorMessage =
        error instanceof Error ? error.message : 'No fue posible crear el lote.';
    } finally {
      this.creatingBatch = false;
    }
  }

  batchRequests(batch: PrintBatch): CredentialRequest[] {
    const requestsById = new Map(this.requests.map((request) => [request.id, request]));

    return batch.requestIds
      .map((requestId) => requestsById.get(requestId))
      .filter((request): request is CredentialRequest => Boolean(request));
  }

  async printBatch(batch: PrintBatch): Promise<void> {
    this.printingBatchId = batch.id;
    this.changeDetectorRef.detectChanges();

    await this.nextPaint();

    const source = document.querySelector<HTMLElement>('.batch-print-selected');

    if (!source) {
      this.printingBatchId = '';
      this.changeDetectorRef.detectChanges();
      return;
    }

    const printRoot = this.createCredentialPrintRoot(source);
    document.body.appendChild(printRoot);
    document.body.classList.add('credential-printing');

    await this.waitForCredentialImages(printRoot);
    await this.nextPaint();

    let cleaned = false;
    let mediaQuery: MediaQueryList | undefined;
    let mediaHandler: ((event: MediaQueryListEvent) => void) | undefined;

    const cleanup = () => {
      if (cleaned) {
        return;
      }

      cleaned = true;
      mediaQuery?.removeEventListener('change', mediaHandler as EventListener);
      window.removeEventListener('afterprint', cleanup);
      printRoot.remove();
      document.body.classList.remove('credential-printing');
      this.printingBatchId = '';
      this.changeDetectorRef.detectChanges();
    };

    mediaQuery = window.matchMedia('print');
    mediaHandler = (event: MediaQueryListEvent) => {
      if (!event.matches) {
        cleanup();
      }
    };

    mediaQuery.addEventListener('change', mediaHandler);
    window.addEventListener('afterprint', cleanup);
    window.print();
  }

  async markBatchPrinted(batch: PrintBatch): Promise<void> {
    this.batchActionId = batch.id;
    this.batchErrorMessage = '';
    this.batchMessage = '';

    try {
      await this.printBatchService.markPrinted(batch.id);
      this.batchMessage = `Lote ${batch.id} marcado como impreso.`;
    } catch (error) {
      this.batchErrorMessage =
        error instanceof Error ? error.message : 'No fue posible cerrar el lote.';
    } finally {
      this.batchActionId = '';
    }
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

  credentialTemplateImageUrl(request: CredentialRequest, side: CredentialTemplateSide): string {
    return this.templateAssetUrl(this.credentialTemplateKey(request), side);
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

  showCredentialTemplateField(
    request: CredentialRequest,
    field: CredentialTemplateFieldKey
  ): boolean {
    if (this.templateLayouts[this.credentialTemplateKey(request)][field].hidden) {
      return false;
    }

    if (request.applicantType === 'STAFF' && (field === 'matricula' || field === 'nivel')) {
      return false;
    }

    if (field === 'programa') {
      return Boolean(this.credentialTemplatePrograma(request));
    }

    return true;
  }

  selectedTemplateKey(): CredentialTemplateKey {
    return this.credentialTemplateKeyFromApplicant(this.selectedTemplateApplicant);
  }

  selectedTemplateImageUrl(): string {
    return this.templateAssetUrl(this.selectedTemplateKey(), this.selectedTemplateSide);
  }

  selectedTemplateAsset(): CredentialTemplateAsset | undefined {
    return this.templateSettings[this.selectedTemplateKey()]?.[this.selectedTemplateSide];
  }

  selectedTemplateUploadKey(): string {
    return `${this.selectedTemplateKey()}-${this.selectedTemplateSide}`;
  }

  templateLabel(templateKey: CredentialTemplateKey): string {
    if (templateKey === 'docente') {
      return 'Docente';
    }

    if (templateKey === 'admin') {
      return 'Administrativo';
    }

    return 'Estudiante';
  }

  templateAssetName(asset: CredentialTemplateAsset | undefined): string {
    return asset?.name || 'Plantilla base incluida';
  }

  async uploadCredentialTemplate(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    this.templateUploadMessage = '';
    this.templateUploadErrorMessage = '';

    if (!file) {
      return;
    }

    const contentType = this.templateContentType(file);

    if (!contentType) {
      this.templateUploadErrorMessage = 'El diseno debe ser PNG o SVG.';
      input.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      this.templateUploadErrorMessage = 'El archivo no debe superar 5 MB.';
      input.value = '';
      return;
    }

    const key = this.selectedTemplateKey();
    const side = this.selectedTemplateSide;

    this.uploadingTemplateKey = `${key}-${side}`;

    try {
      await this.credentialTemplateService.uploadTemplateAsset({ key, side, file });
      this.templateUploadMessage = `Diseno actualizado para ${this.templateLabel(key)} (${
        side === 'front' ? 'frente' : 'reverso'
      }).`;
    } catch (error) {
      this.templateUploadErrorMessage =
        error instanceof Error ? error.message : 'No fue posible subir el diseno.';
    } finally {
      this.uploadingTemplateKey = '';
      input.value = '';
    }
  }

  availableTemplateEditorFields(): CredentialTemplateEditorField[] {
    return this.templateEditorFields.filter((field) => {
      const matchesSide = field.side === this.selectedTemplateSide;
      const matchesTeacher =
        this.selectedTemplateApplicant !== 'TEACHER' || field.key !== 'programa';
      const matchesStaff =
        this.selectedTemplateApplicant !== 'STAFF' ||
        (field.key !== 'matricula' && field.key !== 'nivel');

      return matchesSide && matchesTeacher && matchesStaff;
    });
  }

  visibleTemplateEditorFields(): CredentialTemplateEditorField[] {
    return this.availableTemplateEditorFields().filter(
      (field) => !this.templateFieldHidden(field.key)
    );
  }

  templateEditorFieldLabel(field: CredentialTemplateEditorField): string {
    if (this.selectedTemplateApplicant === 'STAFF' && field.key === 'programa') {
      return 'Puesto';
    }

    return field.label;
  }

  templateEditorFieldStyle(field: CredentialTemplateFieldKey): Record<string, string> {
    return this.templateFieldStyle(this.selectedTemplateKey(), field);
  }

  isTemplateTextField(field: CredentialTemplateFieldKey): boolean {
    return field !== 'photo' && field !== 'qr';
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
      return this.templateSampleRequest()?.career || this.templateSamplePrograma();
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

  templateFieldHidden(field: CredentialTemplateFieldKey): boolean {
    return this.templateLayouts[this.selectedTemplateKey()][field].hidden === true;
  }

  toggleTemplateFieldVisibility(field: CredentialTemplateFieldKey, event: Event): void {
    const input = event.target as HTMLInputElement;
    this.templateLayouts[this.selectedTemplateKey()][field].hidden = !input.checked;
    this.saveTemplateLayouts();
  }

  templateEditorColor(field: CredentialTemplateFieldKey): string {
    const key = this.selectedTemplateKey();

    return (
      this.templateLayouts[key][field].color ||
      this.defaultTemplateLayouts[key][field].color ||
      '#0f1738'
    );
  }

  updateTemplateFieldMetric(
    field: CredentialTemplateFieldKey,
    metric: CredentialTemplateNumericMetric,
    event: Event
  ): void {
    const input = event.target as HTMLInputElement;
    const value = Number(input.value);

    if (Number.isNaN(value)) {
      return;
    }

    const layout = this.templateLayouts[this.selectedTemplateKey()][field];
    const max = metric === 'x' ? 100 - layout.w : metric === 'y' ? 100 - layout.h : 100;
    layout[metric] = this.clamp(value, metric === 'fontSize' ? 1 : 0, max);
    layout.x = this.clamp(layout.x, 0, 100 - layout.w);
    layout.y = this.clamp(layout.y, 0, 100 - layout.h);
    this.saveTemplateLayouts();
  }

  updateTemplateFieldColor(field: CredentialTemplateFieldKey, event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = input.value;

    if (!/^#[0-9a-fA-F]{6}$/.test(value)) {
      return;
    }

    this.templateLayouts[this.selectedTemplateKey()][field].color = value;
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

  async printCredential(request: CredentialRequest): Promise<void> {
    this.printingRequestId = request.id;
    this.changeDetectorRef.detectChanges();

    await this.nextPaint();

    const source = document.querySelector<HTMLElement>('.credential-print-selected');

    if (!source) {
      this.printingRequestId = '';
      this.changeDetectorRef.detectChanges();
      return;
    }

    const printRoot = this.createCredentialPrintRoot(source);
    document.body.appendChild(printRoot);
    document.body.classList.add('credential-printing');

    await this.waitForCredentialImages(printRoot);
    await this.nextPaint();

    let cleaned = false;
    let mediaQuery: MediaQueryList | undefined;
    let mediaHandler: ((event: MediaQueryListEvent) => void) | undefined;

    const cleanup = () => {
      if (cleaned) {
        return;
      }

      cleaned = true;
      mediaQuery?.removeEventListener('change', mediaHandler as EventListener);
      window.removeEventListener('afterprint', cleanup);
      printRoot.remove();
      document.body.classList.remove('credential-printing');
      this.printingRequestId = '';
      this.changeDetectorRef.detectChanges();
    };

    mediaQuery = window.matchMedia('print');
    mediaHandler = (event: MediaQueryListEvent) => {
      if (!event.matches) {
        cleanup();
      }
    };

    mediaQuery.addEventListener('change', mediaHandler);
    window.addEventListener('afterprint', cleanup);
    window.print();
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

  private templateAssetUrl(
    templateKey: CredentialTemplateKey,
    side: CredentialTemplateSide
  ): string {
    return (
      this.templateSettings[templateKey]?.[side]?.url ||
      `/credential-templates/${templateKey}-${side}.png`
    );
  }

  private templateContentType(file: File): 'image/png' | 'image/svg+xml' | '' {
    if (file.type === 'image/png' || file.type === 'image/svg+xml') {
      return file.type;
    }

    const fileName = file.name.toLowerCase();

    if (fileName.endsWith('.png')) {
      return 'image/png';
    }

    if (fileName.endsWith('.svg')) {
      return 'image/svg+xml';
    }

    return '';
  }

  private templateFieldStyle(
    templateKey: CredentialTemplateKey,
    field: CredentialTemplateFieldKey
  ): Record<string, string> {
    const layout = this.templateLayouts[templateKey][field];

    return {
      '--credential-font-size': `${layout.fontSize ?? this.defaultTemplateLayouts[templateKey][field].fontSize ?? 3.4}cqw`,
      color: layout.color || this.defaultTemplateLayouts[templateKey][field].color || '#0f1738',
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

  private templateSamplePrograma(): string {
    if (this.selectedTemplateApplicant === 'STAFF') {
      return 'PUESTO';
    }

    return 'PROGRAMA';
  }

  private nextPaint(): Promise<void> {
    return new Promise((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => resolve());
      });
    });
  }

  private createCredentialPrintRoot(source: HTMLElement): HTMLElement {
    const printRoot = document.createElement('div');
    printRoot.id = 'credential-print-root';

    const cards = Array.from(source.querySelectorAll<HTMLElement>('.credential-card'));

    for (const card of cards) {
      const page = document.createElement('section');
      page.className = 'credential-print-page';
      page.appendChild(card.cloneNode(true));
      printRoot.appendChild(page);
    }

    return printRoot;
  }

  private async waitForCredentialImages(root: HTMLElement): Promise<void> {
    const images = Array.from(root.querySelectorAll('img'));

    await Promise.all(
      images.map((image) => {
        if (image.complete) {
          return Promise.resolve();
        }

        return new Promise<void>((resolve) => {
          const done = () => resolve();

          image.addEventListener('load', done, { once: true });
          image.addEventListener('error', done, { once: true });
        });
      })
    );
  }

  private loadTemplateLayouts(): CredentialTemplateLayouts {
    try {
      const raw = localStorage.getItem(this.templateLayoutStorageKey);

      if (!raw) {
        return this.cloneTemplateLayouts(this.defaultTemplateLayouts);
      }

      const stored = JSON.parse(raw) as Partial<CredentialTemplateLayouts>;
      return this.mergeTemplateLayouts(stored);
    } catch {
      return this.cloneTemplateLayouts(this.defaultTemplateLayouts);
    }
  }

  private saveTemplateLayouts(): void {
    this.persistTemplateLayoutsLocally();
    void this.credentialTemplateService.saveLayouts(this.templateLayouts).catch((error) => {
      this.templateUploadErrorMessage =
        error instanceof Error
          ? error.message
          : 'No fue posible guardar la calibracion visual.';
    });
  }

  private persistTemplateLayoutsLocally(): void {
    try {
      localStorage.setItem(this.templateLayoutStorageKey, JSON.stringify(this.templateLayouts));
    } catch {
      // La calibracion visual sigue funcionando aunque el navegador no permita guardarla.
    }
  }

  private mergeTemplateLayouts(stored: Partial<CredentialTemplateLayouts>): CredentialTemplateLayouts {
    const defaults = this.cloneTemplateLayouts(this.defaultTemplateLayouts);

    for (const key of Object.keys(defaults) as CredentialTemplateKey[]) {
      const storedGroup =
        (stored[key] || {}) as Partial<
          Record<CredentialTemplateFieldKey, Partial<CredentialTemplateFieldLayout>>
        >;

      for (const field of Object.keys(defaults[key]) as CredentialTemplateFieldKey[]) {
        defaults[key][field] = {
          ...defaults[key][field],
          ...(storedGroup[field] || {}),
        };
      }
    }

    return defaults;
  }

  private hasStoredTemplateLayouts(layouts: Partial<CredentialTemplateLayouts>): boolean {
    return (Object.keys(layouts) as CredentialTemplateKey[]).some((key) => {
      const group = layouts[key];

      return Boolean(group && Object.keys(group).length);
    });
  }

  private hasLocalTemplateLayoutStorage(): boolean {
    try {
      return Boolean(localStorage.getItem(this.templateLayoutStorageKey));
    } catch {
      return false;
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
