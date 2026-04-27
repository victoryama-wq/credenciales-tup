import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
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
  imports: [CommonModule, MatCardModule, MatProgressSpinnerModule],
  templateUrl: './credential-verification.component.html',
})
export class CredentialVerificationComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private verificationService = inject(CredentialVerificationService);

  readonly applicantTypeLabels = credentialApplicantTypeLabels;
  readonly statusLabels = statusLabels;

  loading = true;
  errorMessage = '';
  result: CredentialVerificationResult | null = null;

  async ngOnInit(): Promise<void> {
    const token = this.route.snapshot.paramMap.get('token') || '';

    if (!token) {
      this.loading = false;
      this.errorMessage = 'QR inválido o incompleto.';
      return;
    }

    try {
      this.result = await this.verificationService.verify(token);
    } catch (error) {
      this.errorMessage =
        error instanceof Error ? error.message : 'No fue posible verificar la credencial.';
    } finally {
      this.loading = false;
    }
  }
}
