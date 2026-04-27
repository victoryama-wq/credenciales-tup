import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
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
      this.loading = false;
      this.result = null;
      this.errorMessage = 'QR inválido o incompleto.';
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    this.result = null;

    try {
      this.result = await this.verificationService.verify(this.token);
    } catch (error) {
      this.errorMessage =
        error instanceof Error ? error.message : 'No fue posible verificar la credencial.';
    } finally {
      this.loading = false;
    }
  }
}
