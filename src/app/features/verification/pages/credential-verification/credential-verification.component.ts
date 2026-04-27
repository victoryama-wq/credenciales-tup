import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, NgZone, OnInit, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ActivatedRoute } from '@angular/router';
import {
  CredentialVerificationResult,
  credentialApplicantTypeLabels,
  statusLabels,
} from '../../../../core/models/credential-request.model';
import { CredentialVerificationService } from '../../../../core/services/credential-verification.service';

@Component({
  selector: 'app-credential-verification',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatCardModule, MatProgressSpinnerModule],
  templateUrl: './credential-verification.component.html',
})
export class CredentialVerificationComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private verificationService = inject(CredentialVerificationService);
  private changeDetector = inject(ChangeDetectorRef);
  private ngZone = inject(NgZone);

  readonly applicantTypeLabels = credentialApplicantTypeLabels;
  readonly statusLabels = statusLabels;

  loading = true;
  errorMessage = '';
  result: CredentialVerificationResult | null = null;
  private token = '';

  async ngOnInit(): Promise<void> {
    this.token = this.route.snapshot.paramMap.get('token') || '';
    await this.verify();
  }

  async verify(): Promise<void> {
    if (!this.token) {
      this.renderState(() => {
        this.loading = false;
        this.result = null;
        this.errorMessage = 'QR inválido o incompleto.';
      });
      return;
    }

    this.renderState(() => {
      this.loading = true;
      this.errorMessage = '';
      this.result = null;
    });

    try {
      const result = await this.verificationService.verify(this.token);
      this.renderState(() => {
        this.result = result;
      });
    } catch (error) {
      this.renderState(() => {
        this.errorMessage =
          error instanceof Error ? error.message : 'No fue posible verificar la credencial.';
      });
    } finally {
      this.renderState(() => {
        this.loading = false;
      });
    }
  }

  private renderState(update: () => void): void {
    this.ngZone.run(() => {
      update();
      this.changeDetector.detectChanges();
    });
  }
}
