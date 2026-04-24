import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router } from '@angular/router';
import { institutionalEmailDomain } from '../../../../core/auth/institutional-email.util';
import { AuthService } from '../../../../core/services/auth.service';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatCardModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './login-page.component.html',
})
export class LoginPageComponent {
  private authService = inject(AuthService);
  private router = inject(Router);

  readonly institutionalEmailDomain = institutionalEmailDomain;

  loadingMode: 'google' | null = null;
  errorMessage = '';

  get isBusy(): boolean {
    return this.loadingMode !== null;
  }

  async loginWithGoogle(): Promise<void> {
    this.loadingMode = 'google';
    this.errorMessage = '';

    try {
      const userCredential = await this.authService.loginWithGoogle();
      const role = await this.authService.getUserRole(userCredential.user);

      await this.router.navigate([role === 'admin' ? '/admin' : '/student']);
    } catch (error) {
      this.errorMessage = this.authService.formatAuthError(error);
    } finally {
      this.loadingMode = null;
    }
  }
}
